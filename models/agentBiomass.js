//Using ganache
//const web3 = require('../test/Agent.test.js'); //ganache instance
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3 ( new Web3.providers.HttpProvider("http://localhost:8545"));

//calc functions
const gaussian = require('./gaussian');
const {convertArrayGasToPounds, convertArrayWeiToPounds, convertWeiToPounds, convertGasToPounds} = require('../simulation/conversions.js');

//compiled contracts
const exchange = require('../ethereum/exchange');


class AgentBiomass{
    constructor(BIOMASS_PRICE_MIN, BIOMASS_PRICE_MAX){
        this.biomassPrice = BIOMASS_PRICE_MAX; //0.06 to 0.12
        this.baseElectValue = BIOMASS_PRICE_MIN;
        this.maxElectValue = BIOMASS_PRICE_MAX;
        this.tradingHistory = new Array();
        this.askHistory =  new Array();
        this.balanceHistory = new Array();
        this.generationData = new Array();
        this.successfulAskHistory = new Array();
        this.timeRow = 0;
        this.biomassAddress = 0;
        this.unFilledAsks = new Array();
        this.PRICE_OF_ETHER = 250; 
        this.WEI_IN_ETHER = 1000000000000000000;
    }

    loadData(biomassData) {
        
        for (i = 0; i < biomassData.length; i++){

            let currentSupply = {
                time: i, 
                supply: + parseFloat(biomassData[i]).toFixed(0) *  1000 //convert to Wh
                // `parseFloat' 转换 float 浮点数为 string 字符串
                // `biomassData[i]` 是那些CSV文件中的数据遍历
            }
            // 存储查询到的当前的供应量
            this.generationData.push(currentSupply);
        }

        return true;
    }

    setCurrentTime(time) {
        this.timeRow = time;
    }

    // 记录失败的查询
    addUnsuccessfulAsk(ask) {
        this.unFilledAsks.push(ask);
    }

    // 获取账户ID
    async getAccount(index) {
        let accounts = await web3.eth.getAccounts();
        this.ethereumAddress = accounts[index];
        return this.ethereumAddress;
    }

    // 获取账户余额
    async getAgentBalance() {
        let balance = 0;
        try{
            await web3.eth.getBalance(this.ethereumAddress);
        }catch(err){
            console.log('error when trying to get biomass balance', err);
        }
        this.balance = balance;
        this.balanceHistory.push(balance);
        return balance;
    }

    // 出售的逻辑 (主要是决定价格)
    async sellingLogic() {
        //let price = await this.convertToWei(this.baseElectValue);
        // let price1 = await this.convertToWei(this.baseElectValue);
        // let price2 = await this.convertToWei( this.maxElectValue);
        //OR let price = this.formulatePrice(); for variation of prices

        // 获取两个最终价格
        let price1 = this.formulatePrice();
        let price2 = this.formulatePrice();
        price1 = await this.convertToWei(price1);
        price2 = await this.convertToWei(price2);
  
        // 查询两个价格
        await this.placeAsk(price1, this.generationData[this.timeRow].supply/2);
        await this.placeAsk(price2, this.generationData[this.timeRow].supply/2);
    }

    addSuccessfulAsk(price, amount) {
        let date = (new Date).getTime();
        let amountTransaction = price * (amount/1000);
        amountTransaction = parseInt( amountTransaction.toFixed(18));

        let newReceivedTransaction = {
            amount: amountTransaction,
            quantity: amount,
            date: date,
            price: price,
            timeRow: this.timeRow
        }
        this.successfulAskHistory.push(newReceivedTransaction);
    }

    async placeAsk(price, amount){
        let date = (new Date()).getTime(); // 获取今天当前时间

        let checkPrice = convertWeiToPounds(price, this.WEI_IN_ETHER, this.PRICE_OF_ETHER);
        // 交易查询收据
        let transactionReceipt = await exchange.methods.placeAsk(price, amount, date).send({
            from: this.ethereumAddress,
            gas: '3000000'
        });
        let newAsk = {
            address: this.ethereumAddress,
            price: price,
            amount: amount,
            date: date,
            timeRow: this.timeRow,
            transactionCost: transactionReceipt.gasUsed
        }
        // 添加新的查询记录
        this.askHistory.push(newAsk);
        return true;
    }

    // 这里的 wei 是啥？
    async convertToWei(price) {
        try{
            let calcPrice = (price / this.PRICE_OF_ETHER);
            calcPrice = + calcPrice.toFixed(18);
            price = await web3.utils.toWei(`${calcPrice}`, 'ether');
            price = parseInt(price);
            return price;
        }catch(err){
            console.log('error from converting to wei in biomass agent', err);
        }
        
    }

    formulatePrice() {
        // 获取两种形式的平均价格
        let {mean, stdev} = this.getDistributionParameters();
        // 计算真正的价格
        let price = this.getCorrectValue(mean, stdev);
        //sometimes this returns defined, therefore while loop to prevent this
        while (price === undefined || price === null){
            price = this.getCorrectValue(mean, stdev);
        }
        return price;
    }

    // 获取分布式参数：最低价格，最高价格，平均价格，拟平均价格 
    getDistributionParameters(){
        
        let minPrice = this.baseElectValue;
        let maxPrice = this.maxElectValue;
        let mean = ( minPrice + maxPrice) / 2;
        let stdev = ( - minPrice + mean) / 2;
        return { mean, stdev };
        
    }

    // 根据两个不同形式的平均价格来计算真正的最终价格
    getCorrectValue(mean, stdev){
        let standard = gaussian(mean, stdev); // 高斯函数计算
        
        let value = standard();
        // 只有当满足下面条件的时候才返回最终价格：小于最高价格，大于最低价格
        while(value < this.maxElectValue && value > this.baseElectValue){
            
            return value;
        }
        
    } 
            
    
}

module.exports = AgentBiomass;
