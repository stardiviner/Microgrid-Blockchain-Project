项目说明文档
=============

引用的库依赖说明
================

## ganache ##

Personal blockchain for Ethereum development (个人区块链 以太坊开发)

- homepage: https://www.trufflesuite.com/ganache
- source code: https://github.com/trufflesuite/ganache

## web3 ##

Ethereum JavaScript API (以太坊的 JavaScript API 接口库)

- README: https://github.com/ethereum/web3.js#readme
- Docs: https://web3js.readthedocs.io/en/v1.2.9/

其他技术资料
============

# Ethereum/Solidity #

- Solidity 文档: https://solidity.readthedocs.io/

## what is "bids", "Blind Auction"? ##

https://solidity.readthedocs.io/en/v0.5.11/solidity-by-example.html#blind-auction

`bids` 意指 Ethereum 协议里面的**“叫价”**？

是一个 在 `simulation/simulationUniformPrice.js` 文件里 由函数 `getExchangeBids`
返回的一个 `Array()` 数据，具体定义在函数里面的 `newBid` 数组。

源代码文件说明
==============

- bits 是出价
- asks 是要价
- batter 是电力
- biomass 是风力等自然发电类
- gas 是???

# simulation/ #

## simulation/simulationUniformPrice.js ##

在 Git 历史记录 `3227b42` 里面。
有显示

```
renamed    models/agentSimulation.js -> models/agentUniformPrice.js
```

所以修改一些仍然在使用旧文件名的模块。修改文件 `simulation/simSBNationalGrid.js`
以及 `test/AgentSimulation.test.js` 。

### const Agent = require('../models/agentUniformPrice.js'); ###

#### const exchange = require('../ethereum/exchange'); ####

创建一个以太坊合约实例。

``` javascript
//replace this address with the deployed version of exchange
const instance = new web3.eth.Contract(
    JSON.parse(Exchange.interface),
    '0x2E6F116CD99198190920F002183efeBBefA273a9'
);

// export default instance;
module.exports = instance;
```

项目流程说明
=============

运行逻辑流程图

