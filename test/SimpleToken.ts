import { expect, use } from "chai";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

async function deployContract() {
  const [owner, address1, address2, address3, address4, address5] =
    await ethers.getSigners();

  const SimpleToken = await ethers.getContractFactory("SimpleToken");
  const contract = await SimpleToken.deploy();

  const getNodes = async () => {
    const voteId = await contract.voteId();
    const votes = await contract.votes(voteId);
    let index: bigint = votes[0];

    const nodes = [];

    let isBreak = false;

    while (index) {
      const node = await contract.getNode(index);
      nodes.push({
        price: index,
        power: node[2],
        prev: node[0],
        next: node[1],
      });

      if (index === node[1]) {
        console.error("|ERROR| bug: while nodes");
        isBreak = true;
        break;
      }
      index = node[1];
    }

    expect(isBreak).to.equal(false);

    return nodes;
  };

  const getMoveToIndex = async (
    nodes: {
      price: bigint;
      power: bigint;
      prev: bigint;
      next: bigint;
    }[],
    power: bigint
  ) => {
    const node = nodes.find((e) => power > e.power);
    return node?.price || 0n;
  };

  const vote = async (params: { address: any; price: bigint }) => {
    const balance = await contract.balanceOf(params.address);
    const powerInVotes = await contract.getPower(params.price);
    const power = balance + powerInVotes;
    const nodes = await getNodes();
    const index = await getMoveToIndex(nodes, power);

    await contract.vote(params.price, index);
  };

  const startVoting = async () => {
    contract.connect(owner).startVoting(100n);
  };

  const voterTransfer = async (params: {
    msgSender: any;
    addressTo: any;
    value: bigint;
  }) => {
    const msgSenderNode = await contract.getVoterVote(params.msgSender);
    const addressToNode = await contract.getVoterVote(params.addressTo);

    const firstVotePower = await contract.getPower(msgSenderNode);
    const secondVotePower = await contract.getPower(addressToNode);

    let nodes = await getNodes();

    const firstIndex = await getMoveToIndex(
      nodes,
      firstVotePower - params.value
    );

    const nodeIndex = nodes.findIndex((e: any) => e.price == msgSenderNode);

    const prevNode = nodes[nodeIndex].prev;
    const nextNode = nodes[nodeIndex].next;

    const secondIndex = await getMoveToIndex(
      nodes,
      secondVotePower + params.value
    );

    await contract
      .connect(params.msgSender)
      .voterTransfer(params.addressTo, params.value, firstIndex, secondIndex);
  };

  return {
    contract,
    owner,
    address1,
    address2,
    address3,
    address4,
    address5,
    getNodes,
    getMoveToIndex,
    vote,
    startVoting,
    voterTransfer,
  };
}

describe("Deploy contract", () => {
  it("Should have right properties", async () => {
    const { contract } = await deployContract();

    expect(await contract.name()).to.equal("SimpleToken");
    expect(await contract.symbol()).to.equal("ST");
    expect(await contract.tokenPrice()).to.equal(1n);
    expect(await contract.maxTotalSupply()).to.equal(100000n);
    expect(await contract.feePercent()).to.equal(1);
  });
});

describe("Buy&Sell", () => {
  it("Should allow to buy tokens with fee", async () => {
    const { contract, address1 } = await deployContract();

    const purchaseValue = 100n;
    const fee = (purchaseValue * (await contract.feePercent())) / 100n;
    const valueWithFee = purchaseValue - fee;
    const expectedTokens = valueWithFee / (await contract.tokenPrice());

    await contract.connect(address1).buy({ value: purchaseValue });

    expect(await contract.balanceOf(address1.address)).to.equal(expectedTokens);
    expect(await contract.totalSupply()).to.equal(expectedTokens);
  });

  it("Should sell tokens correctly", async function () {
    const { contract, address1 } = await deployContract();
    const purchaseValue = 100n;

    await contract.connect(address1).buy({ value: purchaseValue });
    const tokensToSell = await contract
      .connect(address1)
      .balanceOf(address1.address);

    const balanceBeforeSell = await ethers.provider.getBalance(
      address1.address
    );

    const tx = await contract.connect(address1).sell(tokensToSell);
    const gasOnSellSpent = (await tx.wait())?.gasUsed || 0n;

    const finalBalance = await ethers.provider.getBalance(address1.address);

    const tokenPrice = await contract.tokenPrice();
    const feePercent = await contract.feePercent();

    const etherToReturn = tokenPrice * tokensToSell;
    const fee = (etherToReturn * feePercent) / 100n;
    const sellEth = etherToReturn - fee;

    expect(finalBalance - balanceBeforeSell + gasOnSellSpent).to.be.closeTo(
      sellEth,
      100000000000000
    );
    expect(
      await contract.connect(address1).balanceOf(address1.address)
    ).to.equal(0);
  });

  it("Should not allow to sell more tokens than you have", async function () {
    const { contract, address1 } = await deployContract();

    const tokensToSell = 1000n;

    await expect(
      contract.connect(address1).sell(tokensToSell)
    ).to.be.revertedWith("Not enough tokens");
  });

  it("Should not allow to buy if value of ether send is zero", async () => {
    const purchaseValue = 0n;
    const { contract, address1 } = await deployContract();

    await expect(
      contract.connect(address1).buy({ value: purchaseValue })
    ).to.be.revertedWith("Send some ether to buy tokens.");
    expect(await contract.balanceOf(address1.address)).to.equal(purchaseValue);
  });
});

describe("ERC20", async () => {
  it("Should allow to transfer tokens when you already have them", async () => {
    const purchaseValue = 10000n;
    const { contract, address1, address2 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    const expectedTokens =
      purchaseValue -
      (purchaseValue * 1n) / 100n / (await contract.tokenPrice());
    const expectedTokensSend = expectedTokens / 2n;
    const expectedTokensLeft = expectedTokens / 2n;

    await expect(
      contract.connect(address1).transfer(address2.address, expectedTokensSend)
    )
      .to.emit(contract, "Transfer")
      .withArgs(address1.address, address2.address, expectedTokensSend);

    expect(await contract.balanceOf(address2.address)).to.equal(
      expectedTokensSend
    );
    expect(await contract.balanceOf(address1.address)).to.equal(
      expectedTokensLeft
    );
  });

  it("Should not allow to transfer tokens to zero balance", async () => {
    const purchaseValue = 100n;
    const { contract, address1 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    const expectedTokens =
      purchaseValue -
      (purchaseValue * 1n) / 100n / (await contract.tokenPrice());

    await expect(
      contract.connect(address1).transfer(ethers.ZeroAddress, expectedTokens)
    ).to.be.revertedWith("Cannot transfer to zero address");
  });

  it("Should allow to transferFrom your tokens when you have approved from owner", async () => {
    const purchaseValue = 100000n;
    const { contract, address1, address2, address3 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    const expectedTokens =
      purchaseValue -
      (purchaseValue * 1n) / 100n / (await contract.tokenPrice());
    const expectedTokensApproved = expectedTokens / 2n;
    const expectedTokensLeft = expectedTokens / 2n;

    await contract
      .connect(address1)
      .approve(address2.address, expectedTokensApproved);

    await expect(
      contract
        .connect(address2)
        .transferFrom(
          address1.address,
          address3.address,
          expectedTokensApproved
        )
    )
      .to.emit(contract, "Transfer")
      .withArgs(address1.address, address3.address, expectedTokensApproved);

    expect(await contract.balanceOf(address3.address)).to.equal(
      expectedTokensApproved
    );
    expect(await contract.balanceOf(address1.address)).to.equal(
      expectedTokensLeft
    );

    it("Should correct change 2 voter nodes if voterTransfer", async () => {
      const { contract, address1, address2, voterTransfer, getNodes } =
        await deployContract();
      let res1 = await contract.balanceOf(address1);
      let res2 = await contract.balanceOf(address2);

      await contract.connect(address1).buy({ value: 100n });
      await contract.connect(address2).buy({ value: 100n });

      res1 = await contract.balanceOf(address1);
      res2 = await contract.balanceOf(address2);

      await contract.connect(address1).startVoting(100n);
      await contract.connect(address2).vote(200n, 0);

      await contract.connect(address1).voterTransfer(address2, 50n, 0n, 200n);
    });
  });

  it("Should not allow to transferFrom your tokens to zero address", async () => {
    const purchaseValue = 10000n;
    const { contract, address1, address2 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    const expectedTokens =
      purchaseValue -
      (purchaseValue * 1n) / 100n / (await contract.tokenPrice());
    const expectedTokensApproved = expectedTokens / 2n;

    await contract
      .connect(address1)
      .approve(address2.address, expectedTokensApproved);

    await expect(
      contract
        .connect(address2)
        .transferFrom(
          address1.address,
          ethers.ZeroAddress,
          expectedTokensApproved
        )
    ).to.be.revertedWith("Cannot transfer to zero address");
  });

  it("Should transfer tokens", async () => {
    const purchaseValue = 10000n;

    const { contract, address1, address2 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    const balanceOf1 = await contract.balanceOf(address1);

    await contract.connect(address1).transfer(address2, 100n);

    const balanceOf2 = await contract.balanceOf(address2);

    expect(balanceOf1 - balanceOf2).to.be.equal(9800n);

    expect(balanceOf2).to.be.equal(100n);
  });
});

describe("Voting", async () => {
  it("Should allow start Vote to anyone who has minimum tokens required", async () => {
    const purchaseValue = 50n;
    const { contract, address1 } = await deployContract();

    expect(await contract.isVoting()).to.equal(false);

    await contract.connect(address1).buy({ value: purchaseValue });

    await expect(contract.connect(address1).startVoting(10n)).to.emit(
      contract,
      "VotingStarted"
    );

    expect(await contract.isVoting()).to.equal(true);
  });

  it("Should not allow to start new Vote when current vote is not ended", async () => {
    const purchaseValue = 1000n;
    const { contract, address1 } = await deployContract();

    expect(await contract.isVoting()).to.equal(false);

    await contract.connect(address1).buy({ value: purchaseValue });
    await contract.connect(address1).startVoting(10n);

    await expect(
      contract.connect(address1).startVoting(10n)
    ).to.be.revertedWith("Vote still did not exist");
    expect(await contract.isVoting()).to.equal(true);
  });

  it("Should not allow to start vote if address do not have enough tokens", async () => {
    const { contract, address1 } = await deployContract();

    await expect(
      contract.connect(address1).startVoting(10n)
    ).to.be.revertedWith("Not enough tokens");

    expect(await contract.isVoting()).to.equal(false);
  });

  it("Should not allow to add vote price if address do not have enough tokens for minimal add vote requirence", async () => {
    const purchaseValueOfAddress1 = 10000n;
    const price1 = 10n;
    const price2 = 20n;

    const { contract, address1, address2 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });
    await contract.connect(address1).startVoting(price1);

    await expect(contract.connect(address2).vote(price2, 0)).to.be.revertedWith(
      "Not enough tokens"
    );
  });

  it("Should allow to vote for some price if address have enough tokens", async () => {
    const votePrice = 123n;
    const purchaseValueOfAddress1 = 10000n;
    const purchaseValueOfAddress2 = 100n;
    const { contract, address1, address2, getNodes } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });

    await expect(contract.connect(address1).startVoting(votePrice)).to.emit(
      contract,
      "VotingStarted"
    );

    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    console.log(await getNodes());
    console.log(await contract.votes(0n));
    await contract.connect(address2).vote(votePrice, votePrice);

    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);
    const totalOfTwo = address1Tokens + address2Tokens;

    expect(await contract.getPower(votePrice)).to.equal(totalOfTwo);
  });

  it("Should not allow to vote for some price if vote is not started", async () => {
    const purchaseValue = 100n;
    const { contract, address1 } = await deployContract();

    const proposedPrice = 100n;

    await contract.connect(address1).buy({ value: purchaseValue });

    await expect(
      contract.connect(address1).vote(proposedPrice, 1n)
    ).to.be.revertedWith("the voting hasn't started yet");
  });

  it("Should not allow to vote twice", async () => {
    const purchaseValue = 100n;
    const { contract, address1 } = await deployContract();

    const proposedPrice = 100n;

    await contract.connect(address1).buy({ value: purchaseValue });
    await contract.connect(address1).startVoting(proposedPrice);

    await expect(
      contract.connect(address1).vote(proposedPrice, 0n)
    ).to.be.revertedWith("You already voted!");
  });

  it("Should allow to end vote if time have been ended", async () => {
    const purchaseValue = 100n;
    const { contract, address1 } = await deployContract();

    const proposedPrice = 100n;

    await contract.connect(address1).buy({ value: purchaseValue });
    await contract.connect(address1).startVoting(proposedPrice);

    await mine(500, { interval: 20 });

    await expect(contract.connect(address1).endVoting())
      .to.emit(contract, "PriceChanged")
      .withArgs(proposedPrice);

    expect(await contract.isVoting()).to.equal(false);
    expect(await contract.tokenPrice()).to.equal(proposedPrice);
  });

  // todo:done => add mode voters
  it("Should allow to end vote if time have been ended and more nodes", async () => {
    const randomProposedPrice = 300n;
    const randomProposedPrice1 = 200n;
    const randomProposedPrice2 = 400n;
    const purchaseValueOfAddress1 = 300n;
    const purchaseValueOfAddress2 = 700n;
    const purchaseValueOfAddress3 = 500n;
    const purchaseValueOfAddress4 = 300n;
    const { contract, address1, address2, address3, address4, getNodes } =
      await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });
    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    await contract.connect(address3).buy({ value: purchaseValueOfAddress3 });
    await contract.connect(address4).buy({ value: purchaseValueOfAddress4 });

    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);
    const address3Tokens = await contract.balanceOf(address3.address);
    const address4Tokens = await contract.balanceOf(address4.address);

    await contract.connect(address1).startVoting(randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address2)
      .vote(randomProposedPrice1, randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address3)
      .vote(randomProposedPrice2, randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address4)
      .vote(randomProposedPrice, randomProposedPrice2);

    const nodesArrayBeforeVote = await getNodes();

    console.log(nodesArrayBeforeVote);

    const mock1 = [
      { price: 200n, power: 693n, prev: 0n, next: 300n },
      { price: 300n, power: 594n, prev: 200n, next: 400n },
      { price: 400n, power: 495n, prev: 300n, next: 0n },
    ];

    expect(nodesArrayBeforeVote.length).to.be.equal(mock1.length);

    for (let q = 0; q < mock1.length; q++) {
      expect(mock1[q].next).to.be.equal(nodesArrayBeforeVote[q].next);
      expect(mock1[q].prev).to.be.equal(nodesArrayBeforeVote[q].prev);
      expect(mock1[q].price).to.be.equal(nodesArrayBeforeVote[q].price);
      expect(mock1[q].power).to.be.equal(nodesArrayBeforeVote[q].power);
    }

    await contract.connect(address4).voterSell(address4Tokens, 0n);

    const nodesArray = await getNodes();

    console.log(nodesArray);

    const mock2 = [
      { price: 200n, power: 693n, prev: 0n, next: 400n },
      { price: 400n, power: 495n, prev: 200n, next: 300n },
      { price: 300n, power: 297n, prev: 400n, next: 0n },
    ];

    expect(nodesArray.length).to.be.equal(mock2.length);

    for (let q = 0; q < mock1.length; q++) {
      expect(mock2[q].next).to.be.equal(nodesArray[q].next);
      expect(mock2[q].prev).to.be.equal(nodesArray[q].prev);
      expect(mock2[q].price).to.be.equal(nodesArray[q].price);
      expect(mock2[q].power).to.be.equal(nodesArray[q].power);
    }

    await mine(500, { interval: 20 });

    await expect(contract.connect(address1).endVoting())
      .to.emit(contract, "PriceChanged")
      .withArgs(200n);

    expect(await contract.isVoting()).to.equal(false);
    expect(await contract.tokenPrice()).to.equal(200n);
  });

  it("Should not allow to end vote if time have not been ended", async () => {
    const purchaseValue = 100n;
    const { contract, address1 } = await deployContract();

    const proposedPrice = 100n;

    await contract.connect(address1).buy({ value: purchaseValue });
    await contract.connect(address1).startVoting(proposedPrice);

    await expect(contract.connect(address1).endVoting()).revertedWith(
      "Voting is not over yet"
    );

    expect(await contract.isVoting()).to.equal(true);
    expect(await contract.tokenPrice()).to.equal(1n);
  });

  it("Should remove sell anount of tokens after sell of voter", async () => {
    const randomProposedPrice = 12n;
    const purchaseValue = 101n;
    const { contract, address1, getNodes } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    await contract.connect(address1).startVoting(randomProposedPrice);

    const address1Tokens = await contract.balanceOf(address1.address);
    expect(await contract.getPower(randomProposedPrice)).to.equal(
      address1Tokens
    );

    const sellValue = address1Tokens / 2n;

    console.log(await getNodes());

    await contract.connect(address1).voterSell(sellValue, randomProposedPrice);

    expect(await contract.getPower(randomProposedPrice)).to.equal(sellValue);
  });

  it("Should add buy anount of tokens after buy of voter", async () => {
    const randomProposedPrice = 123n;
    const purchaseValue = 101n;
    const { contract, address1 } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValue });

    await contract.connect(address1).startVoting(randomProposedPrice);

    const address1Tokens = await contract.balanceOf(address1.address);
    expect(await contract.getPower(randomProposedPrice)).to.equal(
      address1Tokens
    );

    await contract
      .connect(address1)
      .voterBuy(randomProposedPrice, { value: purchaseValue });

    const address1TokensAfterBuy = await contract.balanceOf(address1.address);
    expect(await contract.getPower(randomProposedPrice)).to.equal(
      address1TokensAfterBuy
    );
  });

  it("Test insert node after add vote function", async () => {
    const randomProposedPrice = 200n;
    const randomProposedPrice1 = 100n;
    const purchaseValueOfAddress1 = 202n;
    const purchaseValueOfAddress2 = 101n;
    const { contract, address1, address2, getNodes } = await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });

    await expect(
      contract.connect(address1).startVoting(randomProposedPrice)
    ).to.emit(contract, "VotingStarted");

    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    await contract.connect(address2).vote(randomProposedPrice1, 0);

    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);

    const nodesArray = await getNodes();

    const mock = [
      { price: 200n, power: address1Tokens, prev: 0n, next: 100n },
      { price: 100n, power: address2Tokens, prev: 200n, next: 0n },
    ];

    expect(nodesArray.length).to.be.equal(mock.length);

    for (let q = 0; q < mock.length; q++) {
      expect(mock[q].next).to.be.equal(nodesArray[q].next);
      expect(mock[q].prev).to.be.equal(nodesArray[q].prev);
      expect(mock[q].price).to.be.equal(nodesArray[q].price);
      expect(mock[q].power).to.be.equal(nodesArray[q].power);
    }

    console.log(nodesArray);
  });

  it("Test insert node and after add vote", async () => {
    const randomProposedPrice = 300n;
    const randomProposedPrice1 = 200n;
    const purchaseValueOfAddress1 = 303n;
    const purchaseValueOfAddress2 = 202n;
    const purchaseValueOfAddress3 = 101n;
    const { contract, address1, address2, address3, getNodes } =
      await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });

    await expect(
      contract.connect(address1).startVoting(randomProposedPrice)
    ).to.emit(contract, "VotingStarted");

    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    await contract.connect(address2).vote(randomProposedPrice1, 0);

    await contract.connect(address3).buy({ value: purchaseValueOfAddress3 });
    await contract
      .connect(address3)
      .vote(randomProposedPrice, randomProposedPrice);

    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);
    const address3Tokens = await contract.balanceOf(address3.address);
    const totalOf1and3 = address1Tokens + address3Tokens;

    const mock = [
      { price: 300n, power: totalOf1and3, prev: 0n, next: 200n },
      { price: 200n, power: address2Tokens, prev: 300n, next: 0n },
    ];

    const nodesArray = await getNodes();

    expect(nodesArray.length).to.be.equal(mock.length);

    for (let q = 0; q < mock.length; q++) {
      expect(mock[q].next).to.be.equal(nodesArray[q].next);
      expect(mock[q].prev).to.be.equal(nodesArray[q].prev);
      expect(mock[q].price).to.be.equal(nodesArray[q].price);
      expect(mock[q].power).to.be.equal(nodesArray[q].power);
    }
  });

  it("Test insert node and after vote to that node", async () => {
    const randomProposedPrice = 300n;
    const randomProposedPrice1 = 200n;
    const randomProposedPrice2 = 400n;
    const purchaseValueOfAddress1 = 300n;
    const purchaseValueOfAddress2 = 700n;
    const purchaseValueOfAddress3 = 500n;
    const purchaseValueOfAddress4 = 300n;
    const { contract, address1, address2, address3, address4, getNodes } =
      await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });
    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    await contract.connect(address3).buy({ value: purchaseValueOfAddress3 });
    await contract.connect(address4).buy({ value: purchaseValueOfAddress4 });

    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);
    const address3Tokens = await contract.balanceOf(address3.address);
    const address4Tokens = await contract.balanceOf(address4.address);

    await contract.connect(address1).startVoting(randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address2)
      .vote(randomProposedPrice1, randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address3)
      .vote(randomProposedPrice2, randomProposedPrice);

    console.log(await getNodes());

    const nodesArrayBeforeVote = await getNodes();

    const mock1 = [
      { price: 200n, power: address2Tokens, prev: 0n, next: 400n },
      { price: 400n, power: address3Tokens, prev: 200n, next: 300n },
      { price: 300n, power: address1Tokens, prev: 400n, next: 0n },
    ];

    expect(nodesArrayBeforeVote.length).to.be.equal(mock1.length);

    for (let q = 0; q < mock1.length; q++) {
      expect(mock1[q].next).to.be.equal(nodesArrayBeforeVote[q].next);
      expect(mock1[q].prev).to.be.equal(nodesArrayBeforeVote[q].prev);
      expect(mock1[q].price).to.be.equal(nodesArrayBeforeVote[q].price);
      expect(mock1[q].power).to.be.equal(nodesArrayBeforeVote[q].power);
    }

    await contract
      .connect(address4)
      .vote(randomProposedPrice, randomProposedPrice2);

    const nodesArray = await getNodes();

    const mock2 = [
      { price: 200n, power: address2Tokens, prev: 0n, next: 300n },
      {
        price: 300n,
        power: address1Tokens + address4Tokens,
        prev: 200n,
        next: 400n,
      },
      { price: 400n, power: address3Tokens, prev: 300n, next: 0n },
    ];

    expect(nodesArray.length).to.be.equal(mock2.length);

    for (let q = 0; q < mock2.length; q++) {
      expect(mock2[q].next).to.be.equal(nodesArray[q].next);
      expect(mock2[q].prev).to.be.equal(nodesArray[q].prev);
      expect(mock2[q].price).to.be.equal(nodesArray[q].price);
      expect(mock2[q].power).to.be.equal(nodesArray[q].power);
    }
  });

  it("Test insert node and after vote and then sell tokens", async () => {
    const randomProposedPrice = 300n;
    const randomProposedPrice1 = 200n;
    const randomProposedPrice2 = 400n;
    const purchaseValueOfAddress1 = 300n;
    const purchaseValueOfAddress2 = 700n;
    const purchaseValueOfAddress3 = 500n;
    const purchaseValueOfAddress4 = 300n;
    const { contract, address1, address2, address3, address4, getNodes } =
      await deployContract();

    await contract.connect(address1).buy({ value: purchaseValueOfAddress1 });
    await contract.connect(address2).buy({ value: purchaseValueOfAddress2 });
    await contract.connect(address3).buy({ value: purchaseValueOfAddress3 });
    await contract.connect(address4).buy({ value: purchaseValueOfAddress4 });
    const address1Tokens = await contract.balanceOf(address1.address);
    const address2Tokens = await contract.balanceOf(address2.address);
    const address3Tokens = await contract.balanceOf(address3.address);
    const address4Tokens = await contract.balanceOf(address4.address);

    await contract.connect(address1).startVoting(randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address2)
      .vote(randomProposedPrice1, randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address3)
      .vote(randomProposedPrice2, randomProposedPrice);

    console.log(await getNodes());

    await contract
      .connect(address4)
      .vote(randomProposedPrice, randomProposedPrice2);

    const nodesArrayBeforeVote = await getNodes();

    console.log(nodesArrayBeforeVote);

    const mock1 = [
      { price: 200n, power: 693n, prev: 0n, next: 300n },
      { price: 300n, power: 594n, prev: 200n, next: 400n },
      { price: 400n, power: 495n, prev: 300n, next: 0n },
    ];

    expect(nodesArrayBeforeVote.length).to.be.equal(mock1.length);

    for (let q = 0; q < mock1.length; q++) {
      expect(mock1[q].next).to.be.equal(nodesArrayBeforeVote[q].next);
      expect(mock1[q].prev).to.be.equal(nodesArrayBeforeVote[q].prev);
      expect(mock1[q].price).to.be.equal(nodesArrayBeforeVote[q].price);
      expect(mock1[q].power).to.be.equal(nodesArrayBeforeVote[q].power);
    }

    await contract.connect(address4).voterSell(address4Tokens, 0n);

    const nodesArray = await getNodes();

    console.log(nodesArray);

    const mock2 = [
      { price: 200n, power: 693n, prev: 0n, next: 400n },
      { price: 400n, power: 495n, prev: 200n, next: 300n },
      { price: 300n, power: 297n, prev: 400n, next: 0n },
    ];

    expect(nodesArray.length).to.be.equal(mock2.length);

    for (let q = 0; q < mock1.length; q++) {
      expect(mock2[q].next).to.be.equal(nodesArray[q].next);
      expect(mock2[q].prev).to.be.equal(nodesArray[q].prev);
      expect(mock2[q].price).to.be.equal(nodesArray[q].price);
      expect(mock2[q].power).to.be.equal(nodesArray[q].power);
    }
  });
});

describe("linked list", async () => {
  it("insert in linked list", async () => {
    const { contract, address1, address2, voterTransfer, getNodes } =
      await deployContract();

    const mock = [
      {
        price: 100n,
        power: 101n,
        index: 0n,
        next: 50n,
        prev: 200n,
      },
      {
        price: 200n,
        power: 201n,
        index: 100n,
        next: 100n,
        prev: 250n,
      },
      {
        price: 300n,
        power: 301n,
        index: 200n,
        next: 250n,
        prev: 400n,
      },
      {
        price: 250n,
        power: 251n,
        index: 200n,
        next: 200n,
        prev: 300n,
      },
      {
        price: 400n,
        power: 401n,
        index: 300n,
        next: 300n,
        prev: 0n,
      },
      {
        price: 50n,
        power: 51n,
        index: 0n,
        next: 0n,
        prev: 100n,
      },
    ];

    mock.forEach(async (e) => await contract.insert(e.price, e.power, e.index));

    await expect(contract.insert(mock[0].price, 102n, 0n)).to.be.revertedWith(
      "node exists"
    );

    contract.insert(101n, 102n, 0n);
    contract.insert(101n, 999n, 0n);
    contract.insert(1000n, 300n, 400n);

    await expect(contract.insert(101n, 999n, 123n)).to.be.revertedWith(
      "index does not exist or not equal 0"
    );

    const nodes = await getNodes();

    expect(mock.length).to.equal(nodes.length);

    mock.sort((a, b) => {
      return Number(b.power - a.power);
    });

    for (let q = 0; q < mock.length; q++) {
      expect(mock[q].price).to.equal(nodes[q].price);
      expect(mock[q].power).to.equal(nodes[q].power);
      expect(mock[q].next).to.equal(nodes[q].next);
      expect(mock[q].prev).to.equal(nodes[q].prev);
    }
  });

  it("permutation in linked list", async () => {
    const { contract, address1, address2, voterTransfer, getNodes } =
      await deployContract();

    const mock = [
      {
        price: 100n,
        power: 101n,
        index: 0n,
        next: 50n,
        prev: 200n,
      },
      {
        price: 200n,
        power: 201n,
        index: 100n,
        next: 100n,
        prev: 250n,
      },
      {
        price: 300n,
        power: 301n,
        index: 200n,
        next: 250n,
        prev: 400n,
      },
      {
        price: 250n,
        power: 251n,
        index: 200n,
        next: 200n,
        prev: 300n,
      },
      {
        price: 400n,
        power: 401n,
        index: 300n,
        next: 300n,
        prev: 0n,
      },
      {
        price: 50n,
        power: 51n,
        index: 0n,
        next: 0n,
        prev: 100n,
      },
    ];

    const mockEqual = [
      {
        price: 100n, //
        power: 101n,
        next: 0n,
        prev: 200n,
      },
      {
        price: 200n,
        power: 201n,
        next: 100n,
        prev: 250n,
      },
      {
        price: 300n,
        power: 301n,
        next: 250n,
        prev: 400n,
      },
      {
        price: 250n,
        power: 251n,
        next: 200n,
        prev: 300n,
      },
      {
        price: 400n,
        power: 401n,
        next: 300n,
        prev: 50n,
      },
      {
        price: 50n, //
        power: 5100n,
        next: 400n,
        prev: 0n,
      },
    ];

    mock.forEach(async (e) => await contract.insert(e.price, e.power, e.index));

    contract.permutation(50n, 5100n, 400n);

    const nodes = await getNodes();

    expect(mockEqual.length).to.equal(nodes.length);

    mockEqual.sort((a, b) => {
      return Number(b.power - a.power);
    });

    for (let q = 0; q < mockEqual.length; q++) {
      expect(mockEqual[q].price).to.equal(nodes[q].price);
      expect(mockEqual[q].power).to.equal(nodes[q].power);
      expect(mockEqual[q].next).to.equal(nodes[q].next);
      expect(mockEqual[q].prev).to.equal(nodes[q].prev);
    }
  });
});
