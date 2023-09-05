// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "hardhat/console.sol";

// Uncomment this line to use console.log

contract LinkedList {
    uint256 public voteId = 0;

    struct Node {
        uint256 prev;
        uint256 next;
        uint256 power;
    }

    struct SLinkedList {
        uint256 head;
        uint256 tail;
        // price => Node (power)
        mapping(uint256 => Node) nodes;
    }

    // voteId => LinkedList
    mapping(uint256 => SLinkedList) public votes;

    function getTail() internal view returns (uint256) {
        return votes[voteId].tail;
    }

    function setTail(uint256 _price) internal {
        votes[voteId].tail = _price;
    }

    function getHead() internal view returns (uint256) {
        return votes[voteId].head;
    }

    function setHead(uint256 _price) internal {
        votes[voteId].head = _price;
    }

    function getNode(uint256 _price) public view returns (Node memory) {
        return votes[voteId].nodes[_price];
    }

    function newNode(uint256 _price, uint256 _power) internal {
        votes[voteId].nodes[_price].power = _power;
    }

    function setNodeNext(uint256 _price, uint256 _nextPrice) internal {
        votes[voteId].nodes[_price].next = _nextPrice;
    }

    function getNodeNext(uint256 _price) internal view returns (uint256) {
        return votes[voteId].nodes[_price].next;
    }

    function setNodePrev(uint256 _price, uint256 _prevPrice) internal {
        votes[voteId].nodes[_price].prev = _prevPrice;
    }

    function getNodePrev(uint256 _price) internal view returns (uint256) {
        return votes[voteId].nodes[_price].prev;
    }

    function getPower(uint256 _price) public view returns (uint256) {
        return votes[voteId].nodes[_price].power;
    }

    function setPower(
        uint256 _price,
        uint256 _power
    ) internal returns (uint256) {
        return votes[voteId].nodes[_price].power = _power;
    }

    function linkNodes(uint256 _first, uint256 _second) internal {
        setNodeNext(_first, _second);
        setNodePrev(_second, _first);
    }

    function isNodeInList(uint256 _price) internal view returns (bool) {
        bool isNext = getNodeNext(_price) > 0;
        bool isPrev = getNodePrev(_price) > 0;
        bool isHead = getHead() == _price;
        bool isTail = getTail() == _price;
        return (isNext || isPrev || isHead || isTail);
    }

    function push(uint256 _price, uint256 _power) internal {
        newNode(_price, _power);
        if (getTail() == 0) {
            setHead(_price);
            setTail(_price);
        } else {
            linkNodes(getTail(), _price);
            setNodeNext(_price, 0);
            setTail(_price);
        }
    }

    function unshift(uint256 _price, uint256 _power) internal {
        newNode(_price, _power);
        if (getHead() == 0) {
            setHead(_price);
            setTail(_price);
        } else {
            linkNodes(_price, getHead());
            setNodePrev(_price, 0);
            setHead(_price);
        }
    }

    function insertNoEdges(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) internal {
        uint256 prevIndex = getNodePrev(_index);
        newNode(_price, _power);
        linkNodes(prevIndex, _price);
        linkNodes(_price, _index);
    }

    function isCanPush(
        uint256 _power,
        uint256 _index
    ) internal view returns (bool) {
        if (_index == 0) {
            if (getHead() == 0 && getTail() == 0) {
                return true;
            }
            if (getPower(getTail()) >= _power) {
                return true;
            }
        }
        return false;
    }

    function isCanUnshift(
        uint256 _power,
        uint256 _index
    ) internal view returns (bool) {
        if (!isNodeInList(_index)) {
            console.log("isCanUnshift false ====");
            return false;
        }
        uint256 prevIndex = getNodePrev(_index);
        if (prevIndex == 0) {
            if (_power > getPower(getHead())) {
                return true;
            }
        }

        console.log("isCanUnshift false ====");
        return false;
    }

    function isCanInsertNoEdges(
        uint256 _power,
        uint256 _index
    ) internal view returns (bool) {
        uint256 prevIndex = getNodePrev(_index);
        if (_index != 0 && prevIndex != 0) {
            uint256 prevIndexPower = getPower(prevIndex);
            bool commonCondition = _power > getPower(_index);
            bool firstCondition = prevIndexPower > _power && commonCondition;
            bool secondCondition = prevIndexPower == _power && commonCondition;

            if (firstCondition || secondCondition) {
                return true;
            }

            return false;
        }
        return false;
    }

    function _insert(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) internal returns (bool) {
        console.log(_price, _power, _index);

        if (isCanPush(_power, _index)) {
            push(_price, _power);
            return true;
        }

        if (isCanUnshift(_power, _index)) {
            unshift(_price, _power);
            return true;
        }

        if (isCanInsertNoEdges(_power, _index)) {
            insertNoEdges(_price, _power, _index);
            return true;
        }

        return false;
    }

    function _forceInsert(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) internal returns (bool) {
        if (_index == 0) {
            push(_price, _power);
            return true;
        }

        uint256 fprevIndex = getNodePrev(_index);

        if (fprevIndex == 0) {
            unshift(_price, _power);
            return true;
        }

        insertNoEdges(_price, _power, _index);

        return true;
    }

    function isCanInsert(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) internal view returns (bool) {
        require(!isNodeInList(_price), "node exists");
        console.log("_index_", _index);
        require(
            isNodeInList(_index) || _index == 0,
            "index does not exist or not equal 0"
        );
        bool canPush = isCanPush(_power, _index);
        bool canUnshift = isCanUnshift(_power, _index);
        if (canPush || canUnshift) {
            return true;
        }
        return isCanInsertNoEdges(_power, _index);
    }

    function isCanPermutation(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) internal returns (bool) {
        uint256 pricePower = getPower(_price);
        uint256 pricePrev = getNodePrev(_price);

        deleteNode(_price);

        if (isCanInsert(_price, _power, _index)) {
            _forceInsert(_price, pricePower, pricePrev);
            return true;
        } else {
            _forceInsert(_price, pricePower, pricePrev);
            return false;
        }
    }

    function insert(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) public returns (bool) {
        require(_price != _index);
        require(isCanInsert(_price, _power, _index));
        require(_insert(_price, _power, _index));
        return true;
    }

    function deleteNode(uint256 _price) internal returns (bool) {
        require(isNodeInList(_price), "isNodeInList = false");

        bool isHead = getHead() == _price;
        bool isTail = getTail() == _price;
        uint256 nextNode = getNodeNext(_price);
        uint256 prevNode = getNodePrev(_price);

        if (isHead && isTail) {
            setHead(0);
            setTail(0);

            setNodeNext(_price, 0);
            setNodePrev(_price, 0);
            setPower(_price, 0);
            return true;
        }

        if (isHead) {
            setHead(nextNode);

            setNodePrev(nextNode, 0);

            setNodeNext(_price, 0);
            setNodePrev(_price, 0);
            setPower(_price, 0);
            return true;
        }

        if (isTail) {
            setTail(prevNode);

            setNodeNext(prevNode, 0);

            setNodeNext(_price, 0);
            setNodePrev(_price, 0);
            setPower(_price, 0);
            return true;
        }

        setNodeNext(_price, 0);
        setNodePrev(_price, 0);
        setPower(_price, 0);

        linkNodes(prevNode, nextNode);

        return true;
    }

    function permutation(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) public returns (bool) {
        require(isCanPermutation(_price, _power, _index));
        deleteNode(_price);
        _insert(_price, _power, _index);
        return true;
    }

    function forcePermutation(
        uint256 _price,
        uint256 _power,
        uint256 _index
    ) public returns (bool) {
        deleteNode(_price);
        _forceInsert(_price, _power, _index);
        return true;
    }
}
