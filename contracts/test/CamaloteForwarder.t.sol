// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {
    CamaloteForwarder,
    CamaloteForwarderFactory,
    IERC20,
    ITokenMessengerV2
} from "../src/CamaloteForwarder.sol";

contract MockUSDC is IERC20 {
    string public constant name = "USD Coin";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// Registra la última quema y retira los tokens como hace TokenMessengerV2.
contract MockTokenMessenger is ITokenMessengerV2 {
    MockUSDC public immutable usdc;
    uint256 public calls;
    uint256 public lastAmount;
    uint32 public lastDomain;
    bytes32 public lastMintRecipient;
    address public lastBurnToken;
    bytes32 public lastDestinationCaller;
    uint256 public lastMaxFee;
    uint32 public lastFinality;

    constructor(MockUSDC _usdc) {
        usdc = _usdc;
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external override {
        require(maxFee < amount, "Max fee must be less than amount");
        require(mintRecipient != bytes32(0), "Mint recipient must be nonzero");
        require(usdc.transferFrom(msg.sender, address(this), amount), "pull failed");
        calls += 1;
        lastAmount = amount;
        lastDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
        lastMaxFee = maxFee;
        lastFinality = minFinalityThreshold;
    }
}

contract CamaloteForwarderTest is Test {
    MockUSDC usdc;
    MockTokenMessenger messenger;
    CamaloteForwarderFactory factory;

    address owner = makeAddr("owner");
    address feeRecipient = makeAddr("fees");
    address stranger = makeAddr("stranger");
    // Token account de USDC de un cobrador en Solana (32 bytes cualesquiera).
    bytes32 recipient = keccak256("ata-del-cobrador");

    uint256 constant USDC = 1_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        messenger = new MockTokenMessenger(usdc);
        factory = new CamaloteForwarderFactory(
            IERC20(address(usdc)),
            ITokenMessengerV2(address(messenger)),
            owner,
            feeRecipient,
            45, // 0,45 %
            10_000, // piso 0,01
            500_000, // techo 0,50
            5, // maxFee de Circle: 0,05 %
            500_000 // mínimo 0,50
        );
    }

    function test_addressIsDeterministic() public view {
        bytes32 initHash = keccak256(type(CamaloteForwarder).creationCode);
        assertEq(factory.INIT_CODE_HASH(), initHash, "init code hash");
        address expected = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(factory), recipient, initHash))))
        );
        assertEq(factory.forwarderFor(recipient), expected, "create2 address");
        assertFalse(factory.isDeployed(recipient));
    }

    function test_forwardDeploysAndSweeps() public {
        address forwarder = factory.forwarderFor(recipient);
        usdc.mint(forwarder, 100 * USDC);

        vm.prank(stranger); // cualquiera puede disparar el envío
        (uint256 sent, uint256 fee) = factory.forward(recipient);

        assertEq(fee, 450_000, "0,45 % de 100");
        assertEq(sent, 100 * USDC - 450_000, "sale el resto");
        assertTrue(factory.isDeployed(recipient));
        assertEq(CamaloteForwarder(forwarder).mintRecipient(), recipient, "destino fijado");
        assertEq(address(CamaloteForwarder(forwarder).factory()), address(factory));

        assertEq(usdc.balanceOf(forwarder), 0, "no queda nada en el forwarder");
        assertEq(usdc.balanceOf(feeRecipient), 450_000, "comision cobrada");
        assertEq(messenger.calls(), 1);
        assertEq(messenger.lastAmount(), sent);
        assertEq(messenger.lastDomain(), 5, "Solana");
        assertEq(messenger.lastMintRecipient(), recipient);
        assertEq(messenger.lastBurnToken(), address(usdc));
        assertEq(messenger.lastDestinationCaller(), bytes32(0), "cualquiera completa la entrega");
        assertEq(messenger.lastMaxFee(), (sent * 5) / 10_000);
        assertEq(messenger.lastFinality(), 1000, "fast transfer");
    }

    function test_forwardTwiceReusesForwarder() public {
        address forwarder = factory.forwarderFor(recipient);
        usdc.mint(forwarder, 10 * USDC);
        factory.forward(recipient);
        usdc.mint(forwarder, 2000 * USDC);
        (uint256 sent, uint256 fee) = factory.forward(recipient);
        assertEq(fee, 500_000, "techo de medio dolar");
        assertEq(sent, 2000 * USDC - 500_000);
        assertEq(messenger.calls(), 2);
        assertEq(usdc.balanceOf(feeRecipient), 45_000 + 500_000);
    }

    function test_feeMath() public view {
        assertEq(factory.feeFor(500_000), 10_000, "piso de 0,01 sobre 0,50");
        assertEq(factory.feeFor(1 * USDC), 10_000, "piso de 0,01 sobre 1");
        assertEq(factory.feeFor(100 * USDC), 450_000, "0,45 sobre 100");
        assertEq(factory.feeFor(111 * USDC), 499_500, "justo bajo el techo");
        assertEq(factory.feeFor(1000 * USDC), 500_000, "techo");
        assertEq(factory.feeFor(1_000_000 * USDC), 500_000, "techo grande");
    }

    function test_belowMinimumReverts() public {
        address forwarder = factory.forwarderFor(recipient);
        usdc.mint(forwarder, 300_000);
        vm.expectRevert(abi.encodeWithSelector(CamaloteForwarder.BelowMinimum.selector, 300_000, 500_000));
        factory.forward(recipient);
    }

    function test_emptyRecipientReverts() public {
        vm.expectRevert(CamaloteForwarderFactory.EmptyRecipient.selector);
        factory.forward(bytes32(0));
    }

    function test_feeCapsAreHardLimits() public {
        vm.startPrank(owner);
        vm.expectRevert(CamaloteForwarderFactory.FeeAboveCap.selector);
        factory.setFees(feeRecipient, 101, 10_000, 500_000, 5, 500_000); // > 1 %
        vm.expectRevert(CamaloteForwarderFactory.FeeAboveCap.selector);
        factory.setFees(feeRecipient, 45, 10_000, 0, 5, 500_000); // sin techo
        vm.expectRevert(CamaloteForwarderFactory.FeeAboveCap.selector);
        factory.setFees(feeRecipient, 45, 10_000, 1_000_001, 5, 500_000); // techo > 1 USDC
        vm.expectRevert(CamaloteForwarderFactory.FeeAboveCap.selector);
        factory.setFees(feeRecipient, 45, 600_000, 500_000, 5, 500_000); // piso > techo
        vm.expectRevert(CamaloteForwarderFactory.FeeAboveCap.selector);
        factory.setFees(feeRecipient, 45, 10_000, 500_000, 51, 500_000); // maxFee Circle
        // dentro de los techos, se puede
        factory.setFees(feeRecipient, 100, 10_000, 1_000_000, 50, 500_000);
        assertEq(factory.feeBps(), 100);
        vm.stopPrank();
    }

    function test_onlyOwnerSetsFees() public {
        vm.prank(stranger);
        vm.expectRevert(CamaloteForwarderFactory.OnlyOwner.selector);
        factory.setFees(stranger, 45, 10_000, 500_000, 5, 500_000);

        vm.prank(stranger);
        vm.expectRevert(CamaloteForwarderFactory.OnlyOwner.selector);
        factory.transferOwnership(stranger);

        vm.prank(owner);
        factory.transferOwnership(stranger);
        assertEq(factory.owner(), stranger);
    }

    function test_noFeeWithoutRecipient() public {
        vm.prank(owner);
        factory.setFees(address(0), 45, 10_000, 500_000, 5, 500_000);
        assertEq(factory.feeFor(100 * USDC), 0);
        address forwarder = factory.forwarderFor(recipient);
        usdc.mint(forwarder, 100 * USDC);
        (uint256 sent, uint256 fee) = factory.forward(recipient);
        assertEq(fee, 0);
        assertEq(sent, 100 * USDC);
    }

    function test_rescueTokenOnlyOwnerAndNeverUsdc() public {
        address forwarder = factory.forwarderFor(recipient);
        usdc.mint(forwarder, USDC);
        factory.forward(recipient);

        MockUSDC other = new MockUSDC();
        other.mint(forwarder, 7 * USDC);

        vm.prank(stranger);
        vm.expectRevert(CamaloteForwarder.OnlyFactoryOwner.selector);
        CamaloteForwarder(forwarder).rescueToken(address(other), stranger);

        vm.prank(owner);
        vm.expectRevert(CamaloteForwarder.CannotRescueUsdc.selector);
        CamaloteForwarder(forwarder).rescueToken(address(usdc), owner);

        vm.prank(owner);
        CamaloteForwarder(forwarder).rescueToken(address(other), stranger);
        assertEq(other.balanceOf(stranger), 7 * USDC);
    }

    function test_differentRecipientsDifferentAddresses() public view {
        assertTrue(factory.forwarderFor(recipient) != factory.forwarderFor(keccak256("otra")));
    }

    /// Vector para el test de TypeScript (misma cuenta que computa el front).
    function test_printVector() public view {
        console2.log("factory", address(factory));
        console2.logBytes32(recipient);
        console2.log("forwarder", factory.forwarderFor(recipient));
        console2.logBytes32(factory.INIT_CODE_HASH());
    }
}
