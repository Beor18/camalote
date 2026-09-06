// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CamaloteForwarderFactory, IERC20, ITokenMessengerV2} from "../src/CamaloteForwarder.sol";

/// Contra Base Sepolia de verdad (USDC y TokenMessengerV2 oficiales de Circle).
/// Corre solo si hay BASE_SEPOLIA_RPC_URL:
///   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org forge test --match-contract Fork -vv
contract CamaloteForwarderForkTest is Test {
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant TOKEN_MESSENGER_V2 = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;

    function test_forkSweepBurnsThroughCircle() public {
        string memory url = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            console2.log("sin BASE_SEPOLIA_RPC_URL: test de fork omitido");
            return;
        }
        vm.createSelectFork(url);

        address owner = makeAddr("owner");
        address fees = makeAddr("fees");
        CamaloteForwarderFactory factory = new CamaloteForwarderFactory(
            IERC20(USDC), ITokenMessengerV2(TOKEN_MESSENGER_V2), owner, fees, 45, 10_000, 500_000, 5, 500_000
        );
        bytes32 recipient = keccak256("ata-devnet");
        address forwarder = factory.forwarderFor(recipient);

        deal(USDC, forwarder, 25 * 1_000_000);
        assertEq(IERC20(USDC).balanceOf(forwarder), 25 * 1_000_000);

        (uint256 sent, uint256 fee) = factory.forward(recipient);
        assertEq(fee, 112_500, "0,45 % de 25");
        assertEq(sent, 25 * 1_000_000 - 112_500);
        assertEq(IERC20(USDC).balanceOf(forwarder), 0, "quemado por Circle");
        assertEq(IERC20(USDC).balanceOf(fees), 112_500);
    }
}
