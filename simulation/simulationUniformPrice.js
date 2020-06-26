//requirements
//Using ganache
// const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
let web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
const Agent = require('../models/agentUniformPrice.js');
const AgentNationalGrid = require('../models/agentNationalGrid.js'); // 国家电网 ？？？
const AgentBiomass = require('../models/agentBiomass.js');           // Biomass 生物量？？？
const plotly = require('plotly')('guibvieiraProject', 'Whl2UptBOq1gMvQrRGHk'); // 一个画图库 Plot.ly

//compiled contracts
//const factory = require('../ethereum/factory');
const exchange = require('../ethereum/exchange');

//packages and functions imports
const readCSV = require('./readFile.js');
const {convertArrayGasToPounds, convertArrayWeiToPounds, convertWeiToPounds, convertGasToPounds} = require('./conversions.js'); // 导入转换函数
let fs = require('fs');
var csv = require("fast-csv");
let parse = require('csv-parse');
let async = require('async');
let calculateIntersection = require('./intersectionBiomass'); // 计算 bids 和 ask 双方的交集？
let inputFile = './data/metadata-LCOE.csv';
let id = new Array();
let baseValue = new Array();
let baseValueBattery = new Array();

let agentsNoBattery = new Array();
let agentsBattery = new Array();
let numberOfBids = new Array();



//customisable variables for Simulation
const GASPRICE = 2000000000; //wei 一个权重数值价格？
const simulationDays = 183;  // input 模拟时间长度
const PRICE_OF_ETHER = 250;  // 以太坊价格
const NATIONAL_GRID_PRICE = 0.1437; //input 国家电网价格
const BIOMASS_PRICE_MIN = 0.06; //input
const BIOMASS_PRICE_MAX = 0.12; //input
const WEI_IN_ETHER = 1000000000000000000;
const csvResultsFileName = 'output_test3_6months_46agents.csv'; //input


// 初始化所有数据
async function init() {
    let unFilledBids = new Array();
    let unFilledAsks = new Array();
    let aggregatedDemand = new Array();
    let aggregatedSupply = new Array();
    let historicalPricesPlot = new Array();
    let biomassBalanceHistory = new Array();
    let nationalGridBalanceHistory = new Array();
    let amountBidsPerT = new Array();
    let amountAsksPerT = new Array();

    // 获取以太坊的所有账户
    var accounts = await web3.eth.getAccounts();
    // 读取项目的 data/ 目录下的所有csv文件的数据
    // householdHistoricData 为 `household_**.csv` 文件的数据
    let { metaData, householdHistoricData } = await getFiles();

    let biomassData = generateBiomassData(householdHistoricData);
    // 获取电量数据？？？
    let metaDataBattery = metaData.slice(0, Math.floor(metaData.length / 3)); // `slice' 是从数组中切一段数据。
    // 为什么 metaaData 数据的长度除以3？

    // 房子的电量？？？
    let householdDataBattery = householdHistoricData.slice(0, Math.floor(householdHistoricData.length / 3) ); // 取 householdHistoricData 数组的1/3
    // 创建输入数据后的账户
    let { agents, agentNationalGrid, agentBiomass } = await createAgents(metaDataBattery, householdDataBattery, biomassData, 12000, true, BIOMASS_PRICE_MIN, BIOMASS_PRICE_MAX);
    
    let agentsBattery = agents;
    let simulationDurationCalc = 365 / simulationDays; // 365 / 183 设定模拟时间周期
    // simDuration 模拟的持续时间
    let simDuration = householdHistoricData[0].length / Math.round(simulationDurationCalc);    // 取 householdHistoricData 数组第一个元素的长度除以 / 模拟周期

    // 使用 accounts 中最后一个账户作为 ganache 国家电网地址
    let nationalGridAddress = await agentNationalGrid.getAccount(accounts.length-1); // make the last account from ganache to be the national grid address
    // 使用 accounts 倒数第二个作为 Biomass 的账户
    let biomassAddress = await agentBiomass.getAccount(accounts.length-2);

    simDuration = Math.round(simDuration); // float 浮点树时间取整
    let timeArray= new Array(); // 时间序列
    console.log(`using ${agents.length} amount of agents`);
    console.log('sim duration', simDuration);
    console.log('starting simulation');

    for (let i= 0; i < simDuration; i++) {
        timeArray.push(i);
        console.log('time', i);

        // 记录开始模拟前的当前时间，用来后面进行计算模拟的时间
        agentBiomass.setCurrentTime(i);
        // 获取正确的最终平均价格
        try{
            await agentBiomass.sellingLogic();
        }catch(err){
            console.log('agent biomass selling logic', err);
        }

        // 遍历所有账户的电量
        for (let j = 0; j < agentsBattery.length; j++){
            // 记录当前时间
            agentsBattery[j].agent.setCurrentTime(i);

            // 如果模拟持续时间为0, 则设置国家电网的地址和价格
            if( i == 0) {
                await agentsBattery[j].agent.setNationalGrid(NATIONAL_GRID_PRICE, nationalGridAddress);
            }
            
            // 计算及获取购买电力的价格等信息
            try{
                await agentsBattery[j].agent.purchaseLogic();
            } catch(err){
                console.log('error from purchase logic', err);
            }
        }
        
        let { bids, asks } = await getExchangeBids();
        amountBidsPerT.push(bids.length);
        amountAsksPerT.push(asks.length);

        //Decide on price and make transactions to respective receivers
        if (bids.length >= 2  && asks.length  >= 2 ){
            
            let intersection = calculateIntersection(bids, asks); //first is price, next is amount, lastly address
            let pricePounds = convertWeiToPounds(intersection[1], WEI_IN_ETHER, PRICE_OF_ETHER);
            console.log('price in pounds', pricePounds);
            let paidBids = new Array();

            //sort by decreasing amount
            bids = bids.sort(sortByAmount);
            asks = asks.sort(sortByAmount);
            numberOfBids.push(bids.length);

            //populate every agent with the closing price for this time step
            for (let j = 0; j < agentsBattery.length; j++) {
                agentsBattery[j].agent.historicalPrices[i] = intersection[1];
            }

            // { bids2: bids, asks2, agentsBattery2, agentBiomass2, biomassAddress2 } = await matchBids(bids.length - 1, asks.length - 1);
            // bids = bids2;
            //match bids to asks until there are no more left, all settled at single price from 'intersection'
            let { bids: unfilledBids, asks: unfilledAsks, agentsBattery: agentsBattery2, agentBiomass: agentBiomass2, biomassAddress: biomassAddress2 } = await matchBids(bids.length - 1, asks.length - 1, bids, asks, agentsBattery, agentBiomass, biomassAddress, intersection);
            bids = unfilledBids;
            asks = unfilledAsks;
            agentsBattery = agentsBattery2;
            agentBiomass = agentBiomass2;
            biomassAddress = biomassAddress2;

            // console.log('bids length after matching', bids.length);
            // console.log('asks length after matching', asks.length);

            //take care of unfilled bids or asks
            if(bids.length > 0) {
                for (let i = 0; i < bids.length; i++){
                    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[i].address; });
                    obj.agent.unfilledOrdersProcess(); //will discharge what he needs, bid might be higher than what he needs at present
                    unFilledBids.push(bids[i]);
                }
            }
            if(asks.length > 0) {
                for (let i = 0; i < asks.length; i++){

                    if( asks[i].address == biomassAddress) {
                        agentBiomass.addUnsuccessfulAsk(asks[i]);
                    }
                    else {
                        let obj = agentsBattery.find(function (obj) { return obj.agentAccount === asks[i].address; });
                        obj.agent.discharge(asks[i].amount);
                        unFilledAsks.push(asks[i]);
                    }
                }
            }
            try{
                await clearMarket();
            }catch(err){
                console.log('error while trying to clear market', err);
            }
        }
        else if (bids.length < 2  || asks.length  < 2) {
            numberOfBids.push(bids.length);

            //if there isn't enough asks and bids to formulate a closing price, 
            //make sure to notify agents that their bids didn't go through and therefore need to charge or discharge their batteries
            for (let i=0; i < bids.length; i++){
                unFilledBids.push(bids[i]);
                let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[i].address; });
                obj.agent.unfilledOrdersProcess();
                
            }

            for (let i=0; i < asks.length; i++) {

                if ( asks[i].address == biomassAddress) {
                    unFilledAsks.push(asks[i]);
                    agentBiomass.addUnsuccessfulAsk(asks[i]);
                } else {
                    unFilledAsks.push(asks[i]);
                    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === asks[i].address; });
                    obj.agent.charge(asks[i].amount);
                }
            }

            for (let j = 0; j < agentsBattery.length; j++) {
                agentsBattery[j].agent.historicalPrices[i] = 0; //no trade was done on this time slot, therefore attribute 0
            }

            try{
                await clearMarket();
            }catch(err){
                console.log('error while trying to clear market', err);
            }
        }

        for (let j = 0; j < agentsBattery.length; j++) {
            try{
                await agentsBattery[j].agent.setAgentBalance();
            }catch(err){
                console.log('error while setting agent balance', err)
            }
            agentsBattery[j].agent.updateCharge();
        }

        nationalGridBalanceHistory.push( await agentNationalGrid.getAgentBalance() ); //initialise the balance count
        biomassBalanceHistory.push( await agentBiomass.getAgentBalance() );
        

    }

    let agentBalanceAverage = new Array();

    //biomass
    let biomassBalance = new Array();
    let biomassAskAmount = new Array();
    let biomassVolumePounds = new Array();
    let biomassVolumeElect = new Array();
    let biomassVolume = new Array();
    let testVolume = new Array();

    
    let history = agentsBattery[0].agent.historicalPrices;
    let aggActualDemand =  new Array();
    let chargeHistoryAggregated = new Array();
    let transactionCostBid = new Array();
    let transactionCostAsk = new Array();
    let transactionCostAvg = new Array();
    let transactionCost = new Array();
    let nationalGridBidsAggAmount= new Array();
    let nationalGridBidsAggGas = new Array();
    let nationalGridPurchases = new Array();
    let nationalGridTotalCost = new Array();
    
    let nationalGridVolumeElect = new Array();
    let tradingVolumeElect = new Array();
    
    let totalNumberTransactions = new Array();
    let successfulBidsAggAmount = new Array();
    let successfulBidsAggGas = new Array();
    let successfulBidsTotalCost = new Array();
    let percentageNatGridEnergyTrades = new Array();
    let dailyVolume = new Array();
    let blackOutInstances = new Array();
    let hourlyExpenditure = new Array();
    let nationalGridPurchasesDay = new Array();

    let totalExpenditureHourly = new Array();
    let totalExpenditure = new Array();

    //averages parameters (for each agent)
    let averageNumberTransactions = new Array();
    let averageNumberTransactionsDay = new Array();
    let averageNationalGridPurchases = new Array(); 
    let averageNationalGridPurchasesDay = new Array(); 
    let averageExpenditureDay = new Array();
    let averageAsksDay = new Array();
    let averageBidsDay = new Array();



    let agent

    let simulationCSV = new Array();
    let csvData = new Array();
    

    const sumPrices= history.reduce((a, b) => a + b, 0);
    let averagePrices = sumPrices/simDuration;
    averagePrices = convertWeiToPounds(parseInt(averagePrices), WEI_IN_ETHER, PRICE_OF_ETHER);
    console.log('average of prices', averagePrices);

    //Calculating Parameters from simulation to plot
    //
    for (let i = 0; i < simDuration; i++) {
        let demand = new Array();
        let supply = new Array();
        let charge = new Array();
        let gasCostBids = new Array();
        let gasCostAsks = new Array();
        let nationalGridBidsGas = new Array();
        let nationalGridBidsAmount = new Array();
        let nationalGridSumCosts = new Array();
        let nationalGridBidsQuantity = new Array();
        let successfulBidsGas = new Array();
        let successfulBidsAmount = new Array();
        let succesfulBidsSumCosts = new Array();
        let successfulBidsElect = new Array();
        let biomassBidsElect = new Array();
        let biomassVolumeTemp2 = new Array();
        
        
        let agentsBalanceHistory = new Array();


        //conversion from wei to pounds
        historicalPricesPlot[i] = convertWeiToPounds(agentsBattery[0].agent.historicalPrices[i], WEI_IN_ETHER, PRICE_OF_ETHER);

        biomassBalance.push(agentBiomass.balanceHistory[i]);
        
        
        let biomassVolumeTemp = 0;

        for( let j=0; j < agentBiomass.successfulAskHistory.length; j++  ){
            if( agentBiomass.successfulAskHistory[j].timeRow == i){
                biomassVolumeTemp += agentBiomass.successfulAskHistory[j].amount;
            } 
        }
        if(biomassVolumeTemp == 0){
            biomassAskAmount.push(0);
        }
        else{
            let costEther = biomassVolumeTemp / WEI_IN_ETHER;
            let costPounds = costEther * ( parseFloat(PRICE_OF_ETHER.toFixed(18)));
            costPounds = parseFloat(costPounds.toFixed(3));
            biomassAskAmount.push(costPounds);
        }
        //calculate volume biomass
        biomassVolumePounds.push( biomassAskAmount[i]);
        

        for (let j = 0; j < agentsBattery.length; j++) {

            demand.push(agentsBattery[j].agent.historicalDemand[i].demand);
            supply.push(agentsBattery[j].agent.historicalSupply[i].supply);

            agentsBalanceHistory.push( convertWeiToPounds(agentsBattery[j].agent.balanceHistory[i], WEI_IN_ETHER, PRICE_OF_ETHER) );

            for(let k = 0; k < agentsBattery[j].agent.chargeHistory.length; k++ ) {

                if( agentsBattery[j].agent.chargeHistory[k].timeRow == i){
                    charge.push(agentsBattery[j].agent.chargeHistory[k].charge);
                }

            }

            //get black out occurances
            for(let k = 0; k < agentsBattery[j].agent.blackOutTimes.length; k++ ) {

                if( agentsBattery[j].agent.blackOutTimes[k].timeRow == i){
                    blackOutInstances.push(agentsBattery[j].agent.blackOutTimes[k].blackOut);
                }
                else {
                    blackOutInstances.push(0);
                }
            }

            //get Bids from bid history
            for(let k = 0; k < agentsBattery[j].agent.bidHistory.length; k++ ) {

                if( agentsBattery[j].agent.bidHistory[k].timeRow == i){
                    gasCostBids.push(agentsBattery[j].agent.bidHistory[k].transactionCost);
                }
            }
            
            //get ask history
            for(let z=0; z < agentsBattery[j].agent.askHistory.length; z++) {

                if( agentsBattery[j].agent.askHistory[z].timeRow == i){
                    gasCostAsks.push(agentsBattery[j].agent.askHistory[z].transactionCost);
                }
            }

            //get bids that were successful 
            for(let k = 0; k < agentsBattery[j].agent.successfulBidHistory.length; k++) {
                if ( agentsBattery[j].agent.successfulBidHistory[k].timeRow == i) {
                    successfulBidsElect.push(agentsBattery[j].agent.successfulBidHistory[k].quantity);
                    successfulBidsGas.push(agentsBattery[j].agent.successfulBidHistory[k].transactionCost);
                    successfulBidsAmount.push(agentsBattery[j].agent.successfulBidHistory[k].transactionAmount);
                    succesfulBidsSumCosts.push(convertGasToPounds(agentsBattery[j].agent.successfulBidHistory[k].transactionCost, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER));
                    succesfulBidsSumCosts.push(convertWeiToPounds(agentsBattery[j].agent.successfulBidHistory[k].transactionAmount, WEI_IN_ETHER, PRICE_OF_ETHER));
                    
                    if(agentsBattery[j].agent.successfulBidHistory[k].receiver == biomassAddress) {
                        biomassBidsElect.push(agentsBattery[j].agent.successfulBidHistory[k].quantity)
                        biomassVolumeTemp2.push(agentsBattery[j].agent.successfulBidHistory[k].transactionAmount)   
                    }
                }
            }

            //get NationalGrid Purchases
            for(let k=0; k < agentsBattery[j].agent.nationalGridPurchases.length; k++) {
                if ( agentsBattery[j].agent.nationalGridPurchases[k].timeRow == i) {
                    nationalGridBidsQuantity.push(agentsBattery[j].agent.nationalGridPurchases[k].quantity);
                    nationalGridBidsAmount.push(agentsBattery[j].agent.nationalGridPurchases[k].transactionAmount);
                    nationalGridBidsGas.push(agentsBattery[j].agent.nationalGridPurchases[k].transactionCost);
                    nationalGridSumCosts.push(convertGasToPounds(agentsBattery[j].agent.nationalGridPurchases[k].transactionCost, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER));
                    nationalGridSumCosts.push(convertWeiToPounds(agentsBattery[j].agent.nationalGridPurchases[k].transactionAmount, WEI_IN_ETHER, PRICE_OF_ETHER));
                }
            }
        }

        //Calculations to store the results for plots

        //calculations for the bids
        if(gasCostBids.length > 0) {
            if (gasCostBids == undefined) {
                gasCostBids = transactionCostBid [i-1];
            }
            let bidCostPounds = convertArrayGasToPounds(gasCostBids, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            transactionCostBid[i] = bidCostPounds;
        }
        else if(gasCostBids.length == 0) {
            transactionCostBid[i] = 0;
        }

        //calculation for the asks
        if(gasCostAsks.length > 0) {
            let askCostPounds = await convertArrayGasToPounds(gasCostAsks, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            transactionCostAsk[i] = askCostPounds;
        }
        else if(gasCostAsks.length == 0) {
            transactionCostAsk[i] = 0;
        }
        
        //calc for successful bids (the ones actually went through where there was a transaction of ether)
        if(successfulBidsGas.length > 0) {
            let succesfulBidsSumCostsPounds = succesfulBidsSumCosts.reduce((a, b) => a + b, 0);
            let bidsAmountPoundsAveraged = await convertArrayWeiToPounds(successfulBidsAmount, WEI_IN_ETHER, PRICE_OF_ETHER);
            let bidsGasPoundsAveraged = await convertArrayGasToPounds(successfulBidsGas, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            successfulBidsTotalCost[i] = succesfulBidsSumCostsPounds;
            successfulBidsAggAmount[i] = bidsAmountPoundsAveraged;
            successfulBidsAggGas[i] = bidsGasPoundsAveraged;
            tradingVolumeElect.push(successfulBidsElect.reduce((a, b) => a + b, 0));
            biomassVolumeElect.push(biomassBidsElect.reduce((a, b) => a + b, 0));
            let volumePounds = await convertArrayWeiToPounds(biomassVolumeTemp2, WEI_IN_ETHER, PRICE_OF_ETHER);
            biomassVolume.push(volumePounds);
            testVolume.push(volumePounds);
        }
        else if (successfulBidsGas == 0) {
            successfulBidsTotalCost[i] = 0;
            successfulBidsAggAmount[i] = 0;
            successfulBidsAggGas[i] = 0;
            tradingVolumeElect.push(0);
            biomassVolumeElect.push(0);
            biomassVolume.push(0);
        }

        //calc the national grid purchases, amount, gas consumed and frequency
        if(nationalGridBidsGas.length > 0) {
            let nationalGridSumCostsPounds = nationalGridSumCosts.reduce((a, b) => a + b, 0);
            let nationalGridBidsAmountPounds = await convertArrayWeiToPounds(nationalGridBidsAmount, WEI_IN_ETHER, PRICE_OF_ETHER);
            let nationalGridBidsGasPounds = await convertArrayGasToPounds(nationalGridBidsGas, GASPRICE, WEI_IN_ETHER, PRICE_OF_ETHER);
            nationalGridBidsAggAmount[i] = nationalGridBidsAmountPounds;
            nationalGridBidsAggGas[i] = nationalGridBidsGasPounds;
            nationalGridTotalCost[i] = nationalGridSumCostsPounds;
            nationalGridVolumeElect.push( nationalGridBidsQuantity.reduce((a, b) => a + b, 0));

            averageNationalGridPurchases[i] = nationalGridBidsGas.length / agentsBattery.length;
            nationalGridPurchases[i] = nationalGridBidsGas.length;
        }
        else if(nationalGridBidsGas.length == 0) {
            nationalGridPurchases[i] = 0;
            nationalGridBidsAggAmount[i] = 0;
            nationalGridBidsAggGas[i] = 0;
            averageNationalGridPurchases[i] =0;
            nationalGridTotalCost[i] = 0;
            nationalGridVolumeElect.push(0);
        }

        //calculate sum of transactions
        let sumTransactions = nationalGridBidsGas.length + gasCostAsks.length + gasCostBids.length + successfulBidsGas.length;
        totalNumberTransactions.push(sumTransactions);
        let numberMarketTransactions = gasCostAsks.length + gasCostBids.length + successfulBidsGas.length;
        averageNumberTransactions.push(totalNumberTransactions[i] / agentsBattery.length);
        //calculate transaciton Costs
        transactionCostAvg.push((transactionCostAsk[i] + transactionCostBid[i]) / (gasCostAsks.length + gasCostBids.length) );
        transactionCost.push(transactionCostAsk[i] + transactionCostBid[i] + successfulBidsAggGas[i]);
        
        if(successfulBidsGas.length > 0 && nationalGridBidsGas.length > 0) {
            percentageNatGridEnergyTrades.push( (nationalGridBidsGas.length / successfulBidsGas.length ) * 100 );
        } else if( successfulBidsGas.length > 0 && nationalGridBidsGas.length == 0) {
            percentageNatGridEnergyTrades.push(0);
        }
        else if( successfulBidsGas.length == 0) {
            percentageNatGridEnergyTrades.push(0);
        }

        //suming up demand, supply and amount of aggregated charge
        const sumDemand = demand.reduce((a, b) => a + b, 0);
        const sumSupply = supply.reduce((a, b) => a + b, 0);
        const sumCharge = charge.reduce((a, b) => a + b, 0);
        
        aggregatedDemand[i] = sumDemand;
        aggregatedSupply[i] = sumSupply;
        aggActualDemand[i] = sumDemand - sumSupply;
        chargeHistoryAggregated.push( sumCharge );

        //agent balance averaged - history
        agentBalanceAverage.push( (agentsBalanceHistory.reduce((a, b) => a + b, 0)) / agentsBattery.length );
        totalExpenditure.push( agentsBalanceHistory.reduce((a, b) => a + b, 0));

        if(totalExpenditure.length > 0) {
            totalExpenditureHourly[i] = totalExpenditure[i-1] - totalExpenditure[i]
        }
        
        if(agentBalanceAverage.length > 0) {
            hourlyExpenditure[i] = agentBalanceAverage[i-1] - agentBalanceAverage[i];
        }
        
        //calculate day averages
        if( i > 0){
            if(i % 24 == 0) {  
                let initialAverageBalance = 0;
                let finalAverageBalance = 0;
                let calcAverageTransactions = new Array();
                let calcAverageNatGridPurchases = new Array();
                let calcAverageBalanceDay = new Array();
                let calcAverageAsksDay = new Array();
                let calcAverageBidsDay = new Array();
                let calcTradingVolume = new Array();
                let calcNationalGridTransactionDay = new Array();

                for (let j = i - 24; j < i; j++){

                    calcAverageTransactions[j] = averageNumberTransactions[j];
                    calcAverageNatGridPurchases[j] = averageNationalGridPurchases[j];
                    calcNationalGridTransactionDay[j] = nationalGridPurchases[i];
                    calcAverageAsksDay[j] = amountAsksPerT[j];
                    calcAverageBidsDay[j] = amountBidsPerT[j];
                    calcTradingVolume[j] = successfulBidsAggAmount[j];

                    if(j == i - 24) {
                        initialAverageBalance = agentBalanceAverage[j];
                    }

                    if(j == i - 1) {
                        finalAverageBalance= agentBalanceAverage[j];
                    }

                    let dayAverageExpenditure = Math.abs(finalAverageBalance - initialAverageBalance);
                    
                    if(finalAverageBalance != null){
                        averageExpenditureDay[i] = dayAverageExpenditure;
                    }
                    else if (finalAverageBalance == null){
                        averageExpenditureDay[i] = 0;
                    }
                }
                nationalGridPurchasesDay[i] = calcNationalGridTransactionDay.reduce((a, b) => a + b, 0);
                dailyVolume[i] = calcTradingVolume.reduce((a, b) => a + b, 0);
                averageNumberTransactionsDay[i] = calcAverageTransactions.reduce((a, b) => a + b, 0);
                averageNationalGridPurchasesDay[i] = calcAverageNatGridPurchases.reduce((a, b) => a + b, 0);
                averageAsksDay[i] = (calcAverageAsksDay.reduce((a, b) => a + b, 0))/ agentsBattery.length;
                averageBidsDay[i] = (calcAverageBidsDay.reduce((a, b) => a + b, 0)) / agentsBattery.length;
            }
        }
        
        //clean up arrays from empty values
        averageNationalGridPurchasesDay = Array.from(averageNationalGridPurchasesDay, item => item || 0);
        averageAsksDay = Array.from(averageAsksDay, item => item || 0);
        averageBidsDay = Array.from(averageBidsDay, item => item || 0);
        averageExpenditureDay = Array.from(averageExpenditureDay, item => item || 0);
        averageNumberTransactionsDay = Array.from(averageNumberTransactionsDay, item => item || 0);
        dailyVolume = Array.from(dailyVolume, item => item || 0);

        console.log('biomass Volume', biomassVolume[i]);
        
        let newCsvEntry = {
            time: i,
            agg_demand: aggregatedDemand[i],
            agg_supply: aggregatedSupply[i],
            agg_actual_demand: aggActualDemand[i],
            historical_prices: historicalPricesPlot[i],
            cost_transaction: transactionCostAvg[i],
            total_transaction_cost: transactionCost[i],
            total_expenditure_hourly: totalExpenditureHourly[i],
            trading_volume: successfulBidsAggAmount[i],
            biomass_volume: biomassVolumePounds[i],
            nat_grid_volume: nationalGridTotalCost[i],//  nationalGridBidsAggAmount
            trading_volume_elect: tradingVolumeElect[i],
            biomass_volume_elect: biomassVolumeElect[i],
            nat_grid_volume_elect: nationalGridVolumeElect[i],
            no_total_transactions: totalNumberTransactions[i],
            no_trades_market:  successfulBidsGas.length,
            no_market_transactions: numberMarketTransactions,
            no_nat_grid_transactions: nationalGridBidsGas.length,
            no_bids_market: amountBidsPerT[i],
            no_asks_market: amountAsksPerT[i],
            charge_history_agg: chargeHistoryAggregated[i],
            avg_expenditure_hourly: hourlyExpenditure[i],
            avg_transactions_hourly: averageNumberTransactions[i],
            avg_bids_agent: amountBidsPerT[i] / agentsBattery.length,
            avg_asks_agent: amountAsksPerT[i] / agentsBattery.length,
            avg_bids_day: averageBidsDay[i],
            avg_asks_day: averageAsksDay[i],
            avg_cost_day_agent: averageExpenditureDay[i],
            avg_nat_grid_purchases_day: averageNationalGridPurchasesDay[i],
            nat_grid_purchases_day: nationalGridPurchasesDay[i],
            avg_transactions_hourly: averageNumberTransactionsDay[i],
            trading_daily_volume: dailyVolume[i],
            percentage_Market_Trades: percentageNatGridEnergyTrades[i],
            black_Out_Instances: blackOutInstances[i]

        }
        csvData.push(newCsvEntry);
    }
    console.log(`writing results of simulation to csv file : ${csvResultsFileName}`);

    var csvStream = csv.createWriteStream({ headers: true }),
        writableStream = fs.createWriteStream(csvResultsFileName);

    writableStream.on("finish", function () {
        console.log("DONE!");
    });
    
    csvStream.pipe(writableStream);
    for(let i = 0; i < csvData.length; i++){
        csvStream.write(csvData[i]);
    }
    csvStream.end();
};

init();

function standardDeviation(values){
    var avg = average(values);
    
    var squareDiffs = values.map(function(value){
        var diff = value - avg;
        var sqrDiff = diff * diff;
        return sqrDiff;
    });
    
    var avgSquareDiff = average(squareDiffs);
    
    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}

function average(data){
    var sum = data.reduce(function(sum, value){
        return sum + value;
    }, 0);

    var avg = sum / data.length;
    return avg;
}

// 读取文件开头定义的csv元数据定义文件 './data/metadata-LCOE.csv'
async function loadData(inputFile){
    let resultSet = await readCSV(inputFile);
    return resultSet;
}

function deleteRow(arr, row) {
    arr = arr.slice(0); // make copy
    arr.splice(row, 1);
    return arr;
}

async function getFiles() {
    console.log('reading files...');
    let householdFiles = new Array();
    let householdHistoricData = new Array();
    let metaData= await loadData(inputFile);

    // 删除第一行
    metaData = deleteRow(metaData, 0);// remove header of file

    // 遍历所有CSV数据
    for (i = 0; i < metaData.length; i++){
        id.push( metaData[i][0] );
        baseValue.push( metaData[i][2] );
        baseValueBattery.push( metaData[i][3] );
        // 读取所有 csv 数据文件到数组变量，用于下面遍历
        householdFiles.push(`./data/household_${id[i]}.csv`); // `householdFile
    }

    // 加载所有 household 的所有 csv 数据文件
    for (const file of householdFiles){
        householdHistoricData.push( await loadData(file));
    }
    return { metaData, householdHistoricData};
}

// 创建交易Agent账户
async function createAgents(metaData, householdHistoricData, biomassData, batteryCapacity, batteryBool, BIOMASS_PRICE_MIN, BIOMASS_PRICE_MAX) {
    console.log('creating agents...');
    let agents = new Array();
    let agentNationalGrid = new AgentNationalGrid();
    let agentBiomass = new AgentBiomass(BIOMASS_PRICE_MIN, BIOMASS_PRICE_MAX);

    agentBiomass.loadData(biomassData);

    for (const item in metaData){

        // 创建一个账户实例，将数据传入
        //creation of agents and feeding the data in
        agent = new Agent(batteryCapacity, batteryBool); //no battery capacity passed
        // 返回账户
        agentAccount = await agent.getAccount(item);
        
        //household = await agent.deployContract();
        
        await agent.loadSmartMeterData(householdHistoricData[item], baseValue[item], baseValueBattery[item], id [item]);
        let newAgent = {
            id: id[item],
            agent,
            agentAccount
        }
        agents.push(newAgent);
    }
    return { agents, agentNationalGrid,agentBiomass };
}

async function getExchangeBids() {
    let bids = new Array();
    let asks = new Array();
    let bid = 0;
    let ask = 0;

    let bidsCount = await exchange.methods.getBidsCount().call();
    let asksCount = await exchange.methods.getAsksCount().call();

    for (let i = 0; i <= bidsCount - 1 ; i++){
        bid = await exchange.methods.getBid(i).call();

        let date = new Date(parseInt(bid[3]));
        date = date.toLocaleString();
        newBid = {
            price: parseInt(bid[1]),
            amount: parseInt(bid[2]),
            address: bid[0],
            date: date
        }
        bids.push(newBid);
    }
    for (let j = 0; j <= asksCount - 1; j++){
        try {
            ask = await exchange.methods.getAsk(j).call();
        } catch(err){
            console.log('ERROR', err);
        }

        let date = new Date(parseInt(ask[3]));
        date = date.toLocaleString();

        newAsk = {
            price: parseInt(ask[1]),
            amount: parseInt(ask[2]),
            address: ask[0],
            date: date
        }
        asks.push(newAsk);
    }
    return { bids, asks };
}

//decreasing amount
function sortByAmount(a, b) {
    if (a.amount === b.amount) {
        return 0;
    }
    else {
        return (a.amount > b.amount) ? -1 : 1;
    }
}

async function clearMarket() {
    let bidsCount = await exchange.methods.getBidsCount().call();
    let asksCount = await exchange.methods.getAsksCount().call();
    let accounts = await web3.eth.getAccounts();

    for (let i = bidsCount - 1; i >= 0; i--) {
        await exchange.methods.removeBid(i).send({
            from: accounts[accounts.length-3],
            gas: '2000000'
        });
        bidsCount = await exchange.methods.getBidsCount().call();
    }
    for (let i = asksCount - 1; i >= 0; i--) {
        await exchange.methods.removeAsk(i).send({
            from: accounts[accounts.length-3],
            gas: '2000000'
        });
        asksCount = await exchange.methods.getAsksCount().call();
    }
    
    bidsCount = await exchange.methods.getBidsCount().call();
    asksCount = await exchange.methods.getAsksCount().call();

}


function findMatch() {
    let temp = new Array();
    let matchingOrders = new Array();
    let nonMatchedBids = new Array();
    let nonMatchedAsks = new Array();
    for(let i=0; i < bids.length; i++) {
        for(let j=0; j < asks.length; j++) {
            temp[j] = Math.abs(bids[i][0] - asks[j][0]);
        }
        let minimumIndex = indexOfSmallest(temp);
        matchingOrders.push(new Array(bids[i], asks[minimumIndex]));
    }
    
    for(let j=0; j < bids.length; j++){
        if ( matchingOrders.includes(bids[j]) == false){
            nonMatchedBids = bids[j];
        }
    }

    for(let j=0; j < asks.length; j++){
        if ( matchingOrders.includes(asks[j]) == false){
            nonMatchedAsks = asks[j];
        }
    }

    
    return 
}

function indexOfSmallest(a) {
    var lowest = 0;
    for (var i = 1; i < a.length; i++) {
        if (a[i] < a[lowest]) lowest = i;
    }
    return lowest;
}

// 移除第一行
function removeFirsRow(householdHistoricData) { 
    let tempArray = new Array();
    
    // 把除了第一行外的数据放到了一个新的数组并返回
    for(let i = 1; i < householdHistoricData.length; i++) {
        tempArray.push(householdHistoricData[i])
    }
    
    return tempArray;
}

function generateBiomassData(householdHistoricData) {
    let biomassData = Array(householdHistoricData[0].length).fill(0);
    
    for(let i = 0; i < householdHistoricData.length; i++) {

        // 移除第一行
        let singleHousehold = removeFirsRow(householdHistoricData[i]);

        for(let j = 0; j < singleHousehold.length; j++) {
            // 这里是核心的对 Biomass 数据进行计算的代码
            biomassData[j] += singleHousehold[j][1] * 0.9; //satisfy 90% of their needs

        }
    }
    return biomassData;
}

async function matchBids(bid_index, ask_index, bids, asks, agentsBattery, agentBiomass, biomassAddress, intersection) {
    if (bids.length == 0 || asks.length == 0) {
        return { bids, asks, agentsBattery, agentBiomass, biomassAddress };
    }

    let obj = agentsBattery.find(function (obj) { return obj.agentAccount === bids[bid_index].address; });

    if(bids[bid_index].amount - asks[ask_index].amount >= 0){
        let remainder = bids[bid_index].amount - asks[ask_index].amount;
        let calcAmount = bids[bid_index].amount - remainder;

        await obj.agent.sendFunds(intersection[1], calcAmount, asks[ask_index].address );

        if (asks[ask_index].address == biomassAddress) {
            agentBiomass.addSuccessfulAsk( intersection[1], calcAmount);
        } else {
            let objSeller = agentsBattery.find(function (obj) { return obj.agentAccount === asks[ask_index].address; });
            objSeller.agent.discharge(calcAmount);
            objSeller.agent.addSuccessfulAsk(intersection[1], calcAmount);
        }  

        bids[bid_index].amount = remainder;

        if(remainder==0){
            bids.splice(bid_index, 1);
        }
        asks.splice(ask_index, 1);
        
        return (matchBids(bids.length-1, asks.length-1, bids, asks, agentsBattery, agentBiomass, biomassAddress, intersection));
    }

    if(bids[bid_index].amount - asks[ask_index].amount < 0){
        let remainder = asks[ask_index].amount - bids[bid_index].amount;
        let calcAmount = asks[ask_index].amount - remainder;
        
        await obj.agent.sendFunds(intersection[1], calcAmount, asks[ask_index].address );

        if (asks[ask_index].address == biomassAddress) {
            agentBiomass.addSuccessfulAsk(intersection[1], calcAmount);
        } else {
            let objSeller = agentsBattery.find(function (obj) { return obj.agentAccount === asks[ask_index].address; });
            objSeller.agent.discharge(calcAmount);
            objSeller.agent.addSuccessfulAsk(intersection[1], calcAmount);
        } 

        asks[ask_index].amount = remainder;

        if(remainder == 0){
            asks.splice(ask_index, 1);
        }
        bids.splice(bid_index, 1);
        
        return (matchBids(bids.length-1, asks.length-1, bids, asks, agentsBattery, agentBiomass, biomassAddress, intersection)); 
    }
}
