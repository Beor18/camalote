// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev Circle CCTP v2 TokenMessengerV2 (Base).
interface ITokenMessengerV2 {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;
}

/// @title CamaloteForwarder
/// @notice Dirección de cobro no custodial en Base. Los USDC que llegan acá
///         solo pueden salir hacia UNA cuenta de USDC en Solana, fijada al
///         crear el contrato, por el camino oficial de Circle (CCTP v2).
///         Cualquiera puede disparar el envío; nadie puede cambiar el destino.
contract CamaloteForwarder {
    CamaloteForwarderFactory public immutable factory;
    /// @notice Token account de USDC del cobrador en Solana (32 bytes).
    bytes32 public immutable mintRecipient;

    event Swept(uint256 amount, uint256 fee, uint256 sent);

    error BelowMinimum(uint256 balance, uint256 minimum);
    error OnlyFactoryOwner();
    error CannotRescueUsdc();

    constructor() {
        factory = CamaloteForwarderFactory(msg.sender);
        mintRecipient = factory.pendingRecipient();
    }

    /// @notice Manda todo el saldo de USDC hacia Solana, descontando la
    ///         comisión de Camalote (topeada en la fábrica). Sin permisos.
    function sweep() external returns (uint256 sent, uint256 fee) {
        IERC20 usdc = factory.usdc();
        uint256 balance = usdc.balanceOf(address(this));
        uint256 minimum = factory.minAmount();
        if (balance < minimum) revert BelowMinimum(balance, minimum);

        fee = factory.feeFor(balance);
        sent = balance - fee;
        if (fee > 0) {
            require(usdc.transfer(factory.feeRecipient(), fee), "Camalote: fee transfer failed");
        }

        ITokenMessengerV2 messenger = factory.tokenMessenger();
        require(usdc.approve(address(messenger), sent), "Camalote: approve failed");
        uint256 maxFee = (sent * factory.circleMaxFeeBps()) / 10_000;
        messenger.depositForBurn(
            sent,
            factory.SOLANA_DOMAIN(),
            mintRecipient,
            address(usdc),
            bytes32(0), // cualquiera puede completar la entrega en Solana
            maxFee,
            factory.FINALITY_FAST()
        );
        emit Swept(balance, fee, sent);
    }

    /// @notice Si alguien manda otro token por error, el dueño de la fábrica
    ///         lo puede devolver. Los USDC nunca: solo viajan a Solana.
    function rescueToken(address token, address to) external {
        if (msg.sender != factory.owner()) revert OnlyFactoryOwner();
        if (token == address(factory.usdc())) revert CannotRescueUsdc();
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(to, amount), "Camalote: rescue failed");
    }
}

/// @title CamaloteForwarderFactory
/// @notice Crea (con CREATE2) la dirección de cobro de cada cuenta de Solana.
///         La dirección se conoce antes de existir, así el cobrador la puede
///         mostrar y el pagador mandar USDC desde Coinbase o cualquier
///         billetera. La comisión tiene techos grabados en el contrato.
contract CamaloteForwarderFactory {
    uint32 public constant SOLANA_DOMAIN = 5;
    uint32 public constant FINALITY_FAST = 1000;
    /// @notice Techos absolutos: el dueño no puede cobrar más que esto, nunca.
    uint16 public constant MAX_FEE_BPS = 100; // 1 %
    uint256 public constant MAX_FEE_CAP = 1_000_000; // 1 USDC por cobro
    uint16 public constant MAX_CIRCLE_FEE_BPS = 50;

    bytes32 public immutable INIT_CODE_HASH;
    IERC20 public immutable usdc;
    ITokenMessengerV2 public immutable tokenMessenger;

    address public owner;
    address public feeRecipient;
    uint16 public feeBps;
    uint256 public feeMin;
    uint256 public feeMax;
    uint16 public circleMaxFeeBps;
    uint256 public minAmount;
    /// @dev Solo vale durante el CREATE2: el forwarder lo lee en su constructor.
    bytes32 public pendingRecipient;

    event ForwarderDeployed(bytes32 indexed mintRecipient, address forwarder);
    event Forwarded(bytes32 indexed mintRecipient, address forwarder, uint256 amount, uint256 fee, uint256 sent);
    event FeesUpdated(address feeRecipient, uint16 feeBps, uint256 feeMin, uint256 feeMax, uint16 circleMaxFeeBps, uint256 minAmount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error EmptyRecipient();
    error FeeAboveCap();
    error AddressMismatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(
        IERC20 _usdc,
        ITokenMessengerV2 _tokenMessenger,
        address _owner,
        address _feeRecipient,
        uint16 _feeBps,
        uint256 _feeMin,
        uint256 _feeMax,
        uint16 _circleMaxFeeBps,
        uint256 _minAmount
    ) {
        INIT_CODE_HASH = keccak256(type(CamaloteForwarder).creationCode);
        usdc = _usdc;
        tokenMessenger = _tokenMessenger;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
        _setFees(_feeRecipient, _feeBps, _feeMin, _feeMax, _circleMaxFeeBps, _minAmount);
    }

    /// @notice Dirección de cobro de una cuenta de USDC en Solana (exista o no todavía).
    function forwarderFor(bytes32 mintRecipient) public view returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), mintRecipient, INIT_CODE_HASH))
                )
            )
        );
    }

    function isDeployed(bytes32 mintRecipient) external view returns (bool) {
        return forwarderFor(mintRecipient).code.length > 0;
    }

    /// @notice Crea el forwarder si hace falta y manda su saldo a Solana.
    ///         Lo puede llamar cualquiera: el destino está fijado por la dirección.
    function forward(bytes32 mintRecipient) external returns (uint256 sent, uint256 fee) {
        if (mintRecipient == bytes32(0)) revert EmptyRecipient();
        address expected = forwarderFor(mintRecipient);
        CamaloteForwarder forwarder;
        if (expected.code.length == 0) {
            pendingRecipient = mintRecipient;
            forwarder = new CamaloteForwarder{salt: mintRecipient}();
            delete pendingRecipient;
            if (address(forwarder) != expected) revert AddressMismatch();
            emit ForwarderDeployed(mintRecipient, expected);
        } else {
            forwarder = CamaloteForwarder(expected);
        }
        (sent, fee) = forwarder.sweep();
        emit Forwarded(mintRecipient, expected, sent + fee, fee, sent);
    }

    /// @notice Comisión de Camalote para un monto: bps con piso y techo, nunca el total.
    function feeFor(uint256 amount) public view returns (uint256) {
        if (feeRecipient == address(0) || feeBps == 0) return 0;
        uint256 fee = (amount * feeBps) / 10_000;
        if (fee < feeMin) fee = feeMin;
        if (feeMax > 0 && fee > feeMax) fee = feeMax;
        if (fee >= amount) return 0;
        return fee;
    }

    function setFees(
        address _feeRecipient,
        uint16 _feeBps,
        uint256 _feeMin,
        uint256 _feeMax,
        uint16 _circleMaxFeeBps,
        uint256 _minAmount
    ) external onlyOwner {
        _setFees(_feeRecipient, _feeBps, _feeMin, _feeMax, _circleMaxFeeBps, _minAmount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _setFees(
        address _feeRecipient,
        uint16 _feeBps,
        uint256 _feeMin,
        uint256 _feeMax,
        uint16 _circleMaxFeeBps,
        uint256 _minAmount
    ) internal {
        // Techos grabados: sin techo (feeMax = 0) no se permite, y nunca más de 1 % ni de 1 USDC.
        if (_feeBps > MAX_FEE_BPS || _feeMax == 0 || _feeMax > MAX_FEE_CAP || _feeMin > _feeMax) revert FeeAboveCap();
        if (_circleMaxFeeBps > MAX_CIRCLE_FEE_BPS) revert FeeAboveCap();
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        feeMin = _feeMin;
        feeMax = _feeMax;
        circleMaxFeeBps = _circleMaxFeeBps;
        minAmount = _minAmount;
        emit FeesUpdated(_feeRecipient, _feeBps, _feeMin, _feeMax, _circleMaxFeeBps, _minAmount);
    }
}
