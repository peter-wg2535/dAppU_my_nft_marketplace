// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

//https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721.sol
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";

contract Marketplace is  ReentrancyGuard{
    address payable public immutable feeAccount ;  // the account who get fees
    uint  public  immutable feePercent ; // the fee % on sales
    uint public itemCount; 

    constructor(uint _feePercent){
       feeAccount=payable(msg.sender);
       feePercent=_feePercent;
    }

     struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool sold;
    }
    mapping(uint=>Item) public  items ;

    event Item_Offered(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    
    );

    event Item_Bought(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    
    function makeItem(IERC721 _nft,uint _tokenId,uint _price) external nonReentrant {
    
        require(_price>0,"Price must be greater than zero");
    
        itemCount++;

        _nft.transferFrom(msg.sender,address(this),_tokenId);

        items[itemCount]=Item(
          itemCount,
          _nft,
          _tokenId,
          _price,
          payable(msg.sender),
          false
        );

    emit Item_Offered (
        itemCount,
         address(_nft),
        _tokenId,
        _price,
        msg.sender
    );
  }

 function purchaseItem(uint _itemId) external payable nonReentrant{
      uint _totalPrice = getTotalPrice(_itemId);

      // read data directly from storage
      Item storage item = items[_itemId];
      
      require(_itemId > 0 && _itemId <= itemCount, "item doesn't exist");
      require(msg.value >= _totalPrice, "not enough ether to cover item price and market fee");
      require(!item.sold, "item already sold");
      
        // pay money to seller and feeAccount (Owner)
        item.seller.transfer(item.price);
        feeAccount.transfer(_totalPrice - item.price);

        // update item to sold
        item.sold = true;
        // transfer nft-object to buyer
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);
        // emit Bought event
        emit Item_Bought(
            _itemId,
            address(item.nft),
            item.tokenId,
            item.price,
            item.seller,
            msg.sender
        );

 }
 function getTotalPrice(uint _itemId) public view returns(uint){ 
    uint current_price= items[_itemId].price*(100 + feePercent)/100;
    return current_price;
 }



}