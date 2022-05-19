const { expect}=require("chai");
const { ethers } = require("hardhat");

// create lambda function to call
const toWei_X = (num) => ethers.utils.parseEther(num.toString())
const fromWei_X = (num) => ethers.utils.formatEther(num)

describe("Test NTF MarketPlace", ()=>{
    let deployer,acc1,acc2,nft,marketplace
    let URI = "Sample-XYZ-URI"
    let URI2 = "Sample-XYZ-URI2"
    
    const feePercent=1
    beforeEach(async ()=>{
        
        const NFT=await ethers.getContractFactory("NFT");
        const Marketplace=await ethers.getContractFactory("Marketplace");
    
        // Get Signers  ac0,ac1,ac2 and ...other ones
        [deployer,acc1,acc2,...accs]=await ethers.getSigners()
    
        nft=await NFT.deploy();
        marketplace=await Marketplace.deploy(feePercent);

    })
    describe("1-Deployment", ()=>{
        it("Test name and symbol the nft collection",async ()=>{
            expect(await nft.name()).to.be.equal("DApp NFT")
            expect(await nft.symbol()).to.be.equal("DAPP")
        })
        it("Test account and fee the nft market",async ()=>{
            expect(await marketplace.feeAccount()).to.be.equal(deployer.address)
            expect(await marketplace.feePercent()).to.be.equal(feePercent)
        })

    })

    describe("2-Minting NFTs", function () {

        it("Should track each minted NFT", async ()=> {
          // addr1 mints an nft once
          await nft.connect(acc1).mint(URI)
          expect(await nft.tokenCount()).to.equal(1);
          expect(await nft.balanceOf(acc1.address)).to.equal(1);
          expect(await nft.tokenURI(1)).to.equal(URI);

          // addr2 mints an nft twice
          await nft.connect(acc2).mint(URI)
          expect(await nft.tokenCount()).to.equal(2);
          expect(await nft.balanceOf(acc2.address)).to.equal(1);
          expect(await nft.tokenURI(2)).to.equal(URI);

          await nft.connect(acc2).mint(URI2)
          expect(await nft.tokenCount()).to.equal(3);
          expect(await nft.balanceOf(acc2.address)).to.equal(2);
          expect(await nft.tokenURI(3)).to.equal(URI2);
        });
      })
    
    describe("3-Making marketplace items", function () {
        let price = 1
        let result 
        beforeEach(async function () {
          // addr1 mints an nft
          await nft.connect(acc1).mint(URI)
          // addr1 approves marketplace to spend nft prior to transfer your NFT to marketplace
          await nft.connect(acc1).setApprovalForAll(marketplace.address, true)
        })


        it("3.1 track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function () {
            
            await expect(marketplace.connect(acc1).makeItem(nft.address, 1 , toWei_X(price)))
            .to.emit(marketplace, "Item_Offered")
            .withArgs(1,nft.address,1,toWei_X(price),acc1.address)

            expect (await nft.ownerOf(1)).to.equal(marketplace.address)
            expect( await marketplace.itemCount()).to.equal(1)

                // Get item from items mapping then check fields to ensure they are correct
            const item = await marketplace.items(1)
            expect(item.itemId).to.equal(1)
            expect(item.nft).to.equal(nft.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(toWei_X(price))
            expect(item.sold).to.equal(false)

        })

        it("3.2 fail if price=0",async ()=>{
            await expect(
                marketplace.connect(acc1).makeItem(nft.address, 1, 0)
              ).to.be.revertedWith("Price must be greater than zero");
            });
    })
    describe("4-Purchasing marketplace items", ()=> {
        let price = 2
        let fee = (feePercent/100)*price
        let totalPriceInWei
        let tokenId=1

        beforeEach(async ()=>{
          // acc1 conect to mint 
          await nft.connect(acc1).mint(URI)
          // acc1 connect to all approval to market place
          await nft.connect(acc1).setApprovalForAll(marketplace.address,true)
          // acc1 make item
          await marketplace.connect(acc1).makeItem(nft.address,tokenId,toWei_X (price))
        
        })

        it("4.1 Purchase item and update data from the first owner to the anater one", async  ()=> {
            //update item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event
            const sellerInitalEthBal = await acc1.getBalance()
            const feeAccountInitialEthBal = await deployer.getBalance()   //acc0 is ower

             // fetch items total price (market fees + item price)
            totalPriceInWei = await marketplace.getTotalPrice( tokenId);
            console.log("Init All of Balance")
            console.log("sellerBal: "+(+fromWei_X(sellerInitalEthBal)),"- feeAccountBal:",+fromWei_X(feeAccountInitialEthBal),"-totalPrice & fee:",+fromWei_X(totalPriceInWei))
   
            // acc2 purchases item.
            await expect(marketplace.connect(acc2).purchaseItem(tokenId, {value: totalPriceInWei}))
             .to.emit(marketplace, "Item_Bought").withArgs(tokenId,nft.address,
               tokenId,toWei_X(price),acc1.address,acc2.address)

            const sellerFinalEthBal = await acc1.getBalance()
            const feeAccountFinalEthBal = await deployer.getBalance()
    
            // Item should be marked as sold
            expect((await marketplace.items(tokenId)).sold).to.equal(true)
    
            //Convert to big number  +(value)
            // Seller should receive payment for the price of the NFT sold.
            expect(+fromWei_X(sellerFinalEthBal)).to.equal(+price + +fromWei_X(sellerInitalEthBal))
            // feeAccount should receive fee
            expect(+fromWei_X(feeAccountFinalEthBal)).to.equal((+fee) + (+fromWei_X(feeAccountInitialEthBal)))
            // The buyer should now own the nft
            expect(await nft.ownerOf(tokenId)).to.equal(acc2.address);    

        })
        it("4.2 Should fail for invalid item ids, sold items and when not enough ether is paid", async function () {
            // fails for invalid item ids
            const valid_tokenId=1
            
            const none_tokenId1=2
            const none_tokenId2=0

            invalid_price=0
            
            await expect(
              marketplace.connect(acc2).purchaseItem(none_tokenId1, {value: totalPriceInWei})
            ).to.be.revertedWith("item doesn't exist");
            await expect(
              marketplace.connect(acc2).purchaseItem(none_tokenId2, {value: totalPriceInWei})
            ).to.be.revertedWith("item doesn't exist");

            // Fails when not enough ether is paid with the transaction. 
            // In this instance, fails when buyer only sends enough ether to cover the price of the nft
            // not the additional market fee.
            await expect(
              marketplace.connect(acc2).purchaseItem(tokenId, {value: toWei_X(price)})
            ).to.be.revertedWith("not enough ether to cover item price and market fee"); 


            //=============let acc2 puchase item first and acc2 try to buy already bought item.================
            // // addr2 purchases item 1 but acc3 want to buy
            await marketplace.connect(acc2).purchaseItem(tokenId, {value: totalPriceInWei})
            // // addr3 tries purchasing item 1 after its been sold 
            const acc3 = accs[0]
            await expect(
              marketplace.connect(acc3).purchaseItem(1, {value: totalPriceInWei})
            ).to.be.revertedWith("item already sold");
          });

    }) 
});