// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "./BuySell.sol";

contract SimpleToken is BuySell {
    function transfer(
        address _to,
        uint256 _value
    ) public override returns (bool) {
        require(_to != address(0), "Cannot transfer to zero address");
        require(!isVoter(msg.sender) && !isVoter(_to));
        require(_balances[msg.sender] >= _value);
        _balances[msg.sender] -= _value;
        _balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override returns (bool) {
        require(_to != address(0), "Cannot transfer to zero address");
        require(!isVoter(msg.sender) && !isVoter(_to));
        require(_allowances[msg.sender][_from] >= _value);
        require(_balances[_from] >= _value);
        _balances[_from] -= _value;
        _balances[_to] += _value;
        _allowances[msg.sender][_from] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function voterTransfer(
        address _to,
        uint256 _value,
        uint256 _firstIndex,
        uint256 _secondIndex
    ) public returns (bool) {
        require(_to != address(0), "Cannot transfer to zero address");
        bool msgSenderisVoter = isVoter(msg.sender);
        bool toIsVoter = isVoter(_to);
        require(msgSenderisVoter && toIsVoter);
        require(_balances[msg.sender] >= _value);

        uint256 firstVoterPrice = getVoterVote(msg.sender);
        uint256 secondVoterPrice = getVoterVote(_to);

        uint256 firstPower = getPower(firstVoterPrice);
        uint256 secondPower = getPower(secondVoterPrice);

        uint256 before = getNodeNext(firstVoterPrice);

        if (
            isCanPermutation(firstVoterPrice, firstPower - _value, _firstIndex)
        ) {
            permutation(firstVoterPrice, firstPower - _value, _firstIndex);
        } else {
            require(false, "cant insert node _firstIndex");
        }

        if (
            isCanPermutation(
                secondVoterPrice,
                secondPower + _value,
                _secondIndex
            )
        ) {
            permutation(secondVoterPrice, secondPower + _value, _secondIndex);
        } else {
            forcePermutation(firstVoterPrice, firstPower, before);
            require(false, "cant insert node _secondIndex");
        }

        _balances[msg.sender] -= _value;
        _balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function voterTransferFrom(
        address _from,
        address _to,
        uint256 _value,
        uint256 _firstIndex,
        uint256 _secondIndex
    ) public returns (bool) {
        require(_to != address(0), "Cannot transfer to zero address");
        require(_allowances[msg.sender][_from] >= _value);
        require(_balances[_from] >= _value);

        bool msgSenderisVoter = isVoter(_from);
        bool toIsVoter = isVoter(_to);

        require(msgSenderisVoter && toIsVoter);

        uint256 firstVoterPrice = getVoterVote(msg.sender);
        uint256 secondVoterPrice = getVoterVote(_to);

        uint256 firstPower = getPower(firstVoterPrice);
        uint256 secondPower = getPower(secondVoterPrice);

        uint256 before = getNodeNext(firstVoterPrice);

        if (
            isCanPermutation(firstVoterPrice, firstPower - _value, _firstIndex)
        ) {
            permutation(firstVoterPrice, firstPower - _value, _firstIndex);
        } else {
            return (false);
        }

        if (
            isCanPermutation(
                secondVoterPrice,
                secondPower + _value,
                _secondIndex
            )
        ) {
            permutation(secondVoterPrice, secondPower + _value, _secondIndex);
        } else {
            forcePermutation(firstVoterPrice, firstPower, before);
            return (false);
        }

        _balances[_from] -= _value;
        _balances[_to] += _value;
        _allowances[msg.sender][_from] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}
