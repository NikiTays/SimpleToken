// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LinkedList.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract ERC20 is IERC20 {
    string public name = "SimpleToken";
    string public symbol = "ST";
    uint256 public totalSupply = 0;

    mapping(address => uint) _balances;
    mapping(address => mapping(address => uint256)) public _allowances;

    function balanceOf(address _owner) public view returns (uint256) {
        return _balances[_owner];
    }

    function transfer(
        address _to,
        uint256 _value
    ) public virtual returns (bool) {}

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public virtual returns (bool) {}

    function approve(address _spender, uint256 _value) public returns (bool) {
        require(_balances[msg.sender] >= _value);
        _allowances[_spender][msg.sender] = _value;
        return true;
    }

    function allowance(
        address _owner,
        address _spender
    ) public view returns (uint256) {
        return _allowances[_spender][_owner];
    }
}
