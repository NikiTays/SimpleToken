// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "./Voting.sol";

// Uncomment this line to use console.log

contract BuySell is Voting {
    uint256 public maxTotalSupply = 100000 * 1 ether;
    uint16 public constant feePercent = 100;
    uint16 public constant feeDecimal = 10000;

    function mint(address _address, uint256 _amount) private {
        _balances[_address] += _amount;
        totalSupply += _amount;
    }

    function burn(address _address, uint256 _amount) private {
        _balances[_address] -= _amount;
        totalSupply -= _amount;
    }

    function calcBuyTokensByEth() internal returns (uint256) {
        require(msg.value > 0, "Send some ether to buy tokens.");
        uint256 fee = (msg.value * feePercent) / feeDecimal;
        uint256 valueWithFee = msg.value - fee;
        uint256 buyValue = valueWithFee / tokenPrice;
        require(buyValue <= maxTotalSupply - totalSupply);

        return buyValue;
    }

    function _buy() internal returns (bool) {
        uint256 buyValue = calcBuyTokensByEth();
        mint(msg.sender, buyValue);
        return true;
    }

    function buy() public payable {
        require(!isVoter(msg.sender));
        _buy();
    }

    function voterBuy(uint256 _index) public payable {
        require(isVoter(msg.sender));
        uint256 price = getVoterVote(msg.sender);
        uint256 power = getPower(price);
        uint256 tokensByEth = calcBuyTokensByEth();
        uint256 updatePower = power + tokensByEth;
        require(isCanPermutation(price, updatePower, _index));
        permutation(price, updatePower, _index);
        _buy();
    }

    function calcSellTokensByEth(
        uint256 _tokensToSell
    ) internal view returns (uint256) {
        require(balanceOf(msg.sender) >= _tokensToSell, "Not enough tokens");
        uint256 ethersToReturn = (_tokensToSell * tokenPrice);
        uint256 fee = (ethersToReturn * feePercent) / feeDecimal;
        uint256 sellEth = ethersToReturn - fee;
        bool isCanSell = address(this).balance >= sellEth;
        require(isCanSell, "ethers < sellValue");

        return (sellEth);
    }

    function _sell(uint256 _tokensToSell) internal {
        uint256 sellValue = calcSellTokensByEth(_tokensToSell);
        burn(msg.sender, _tokensToSell);
        payable(msg.sender).transfer(sellValue);
    }

    function sell(uint256 _tokensToSell) public payable {
        require(!isVoter(msg.sender));
        _sell(_tokensToSell);
    }

    function voterSell(uint256 _tokensToSell, uint256 _index) public payable {
        require(isVoter(msg.sender));
        uint256 price = getVoterVote(msg.sender);
        uint256 power = getPower(price);
        if (power >= _tokensToSell) {
            uint256 updatePower = power - _tokensToSell;
            require(isCanPermutation(price, updatePower, _index));
            require(calcSellTokensByEth(_tokensToSell) > 0);
            permutation(price, updatePower, _index);
            _sell(_tokensToSell);
        }
    }
}
