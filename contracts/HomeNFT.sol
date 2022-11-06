// contracts/MBSContract.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract HomeNFT is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("Gypsy Porfolio", "HOME") {}

    function count() public view returns (uint256) {
        uint256 newHomeId = _tokenIds.current();
        return newHomeId;
    }

    function mintHome(address owner, string memory tokenURI)
        public
        returns (uint256)
    {
        _tokenIds.increment();

        uint256 newHomeId = _tokenIds.current();
        _mint(owner, newHomeId);
        _setTokenURI(newHomeId, tokenURI);

        return newHomeId;
    }
}