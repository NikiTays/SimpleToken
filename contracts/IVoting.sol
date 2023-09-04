// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.21;

interface IVoting {
    event VotingStarted(uint256 time);
    event Voted(address indexed voter, uint256 price);
    event PriceChanged(uint256 newPrice);
}
