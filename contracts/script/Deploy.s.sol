// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CamaloteForwarderFactory, IERC20, ITokenMessengerV2} from "../src/CamaloteForwarder.sol";

/// Despliega la fábrica. Variables de entorno:
///   USDC, TOKEN_MESSENGER_V2, OWNER, FEE_RECIPIENT,
///   FEE_BPS (45), FEE_MIN (10000), FEE_MAX (500000), CIRCLE_MAX_FEE_BPS (5), MIN_AMOUNT (500000)
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC");
        address messenger = vm.envAddress("TOKEN_MESSENGER_V2");
        address owner = vm.envAddress("OWNER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(45)));
        uint256 feeMin = vm.envOr("FEE_MIN", uint256(10_000));
        uint256 feeMax = vm.envOr("FEE_MAX", uint256(500_000));
        uint16 circleMaxFeeBps = uint16(vm.envOr("CIRCLE_MAX_FEE_BPS", uint256(5)));
        uint256 minAmount = vm.envOr("MIN_AMOUNT", uint256(500_000));

        vm.startBroadcast();
        CamaloteForwarderFactory factory = new CamaloteForwarderFactory(
            IERC20(usdc),
            ITokenMessengerV2(messenger),
            owner,
            feeRecipient,
            feeBps,
            feeMin,
            feeMax,
            circleMaxFeeBps,
            minAmount
        );
        vm.stopBroadcast();

        console2.log("CamaloteForwarderFactory:", address(factory));
        console2.log("INIT_CODE_HASH:");
        console2.logBytes32(factory.INIT_CODE_HASH());
    }
}
