// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "./LinkedList.sol";
import "./ERC20.sol";
import "./IVoting.sol";

contract Voting is IVoting, ERC20, LinkedList {
    uint256 public timeToVote = 1 minutes;
    uint256 public votingStartTime = 0;
    uint256 public minTokenAmount = 50 * 1 ether;
    uint256 public tokenPrice = 1;
    bool public isVoting = false;

    // voteId => voter => price
    mapping(uint256 => mapping(address => uint256)) voters;

    function addVoter(address _voter, uint256 _price) internal {
        voters[voteId][_voter] = _price;
    }

    function getVoterVote(address _voter) public view returns (uint256) {
        return voters[voteId][_voter];
    }

    function isVoter(address _voter) internal view returns (bool) {
        return (voters[voteId][_voter] > 0);
    }

    function startVoting(uint256 _price) public {
        require(!isVoting, "Vote still did not exist");
        require(block.timestamp > votingStartTime + timeToVote);
        require(balanceOf(msg.sender) >= minTokenAmount, "Not enough tokens");
        require(insert(_price, _balances[msg.sender], 0));
        addVoter(msg.sender, _price);
        isVoting = true;
        votingStartTime = block.timestamp;
        emit VotingStarted(votingStartTime);
    }

    function vote(uint256 _price, uint256 _index) public returns (bool) {
        require(isVoting, "the voting hasn't started yet");
        require(!isVoter(msg.sender), "You already voted!");
        require(_balances[msg.sender] >= 1, "Not enough tokens");

        if (balanceOf(msg.sender) >= minTokenAmount) {
            if (!isNodeInList(_price)) {
                require(insert(_price, balanceOf(msg.sender), _index));
                addVoter(msg.sender, _price);
                return true;
            } else {
                uint256 power = getPower(_price) + balanceOf(msg.sender);
                require(permutation(_price, power, _index));
                addVoter(msg.sender, _price);
                return true;
            }
        }

        if (_balances[msg.sender] >= 1) {
            require(isNodeInList(_price));
            uint256 power = getPower(_price) + balanceOf(msg.sender);
            require(permutation(_price, power, _index));
            addVoter(msg.sender, _price);
            return true;
        }

        return true;
    }

    function endVoting() public {
        require(isVoting);
        require(
            block.timestamp > votingStartTime + timeToVote,
            "Voting is not over yet"
        );

        tokenPrice = getHead();

        isVoting = false;
        voteId++;
        emit PriceChanged(tokenPrice);
    }
}
