// // Data
const ganache = require('ganache-cli');
const Web3 = require('web3');
web3 = new Web3( new Web3.providers.HttpProvider("http://localhost:8545"));
let fastcsv = require('fast-csv');
var fs = require('fs');

    // tempArray = [ [[' hour'], ['average demand'], ['average supply']],
    //            [[1], [5],[10]],
    //             [[2],[3],[4]],
    //             [[5],[6],[7]],
    //             [[8],[9],[10]]];

    // var fast_csv = fastcsv.createWriteStream();
    // var writeStream = fs.createWriteStream("outputfile.csv");
    // fast_csv.pipe(writeStream);

    // for(var i = 0; i < tempArray.length; i++){
    //     let arrayWrite = new Array();
    //     for(let j=0; j< tempArray[0].length; j++){
    //     arrayTemp2 = new Array();
    //     arrayWrite.push(tempArray[i][j]);
    //     // fast_csv.write( [ tempArray[i][j] ] );             //each element inside bracket
    //     }
    //     fast_csv.write( [ arrayWrite ] );
    //     }
    // fast_csv.end();

    let array = [["0", "0", "0", "0"], [0,1,2,3], [0,1,2,3]];
    function deleteRow(arr, row) {
        arr = arr.slice(0); // make copy
        arr.splice(row - 1, 1);
        return arr;
     }
    let arr = deleteRow(array, 0)
    console.log('array', arr);
    console.log(array.length)

// var address1 = {id: 124, agent: 'bla', address: 0xb181FB52b6e5Ee5915fdB3ad678E0b8a753C3bd3};
// var addressx = address1;
// var address2 = {id: 314, agent: 'bla', address: 0xA1B0d2152E36ebd2ac8e4FC3309cF093E28B1F5c};
// var address3 = {id: 172, agent: 'bla', address: 0x4DD1680B58B821C5c631f56D9280Ccc9c3051377};
// var address4 = {id: 314, agent: 'dd', address: 0xA1B0d2152E36ebd2ac8e4FC3309cF093E28B1F5c};
// var address5 = {id: 172, agent: 'tugga', address: 0x4DD1680B58B821C5c631f56D9280Ccc9c3041377};
// var address6 = {id: 314, agent: 'bla', address: 0xA1B0d2152E36ebd2ac8e4FC3309cF093E28B1F5c};
// var address7 = {id: 172, agent: 'bla', address: 0x4DD1680B5821C5c631f56D9280Ccc9c345051377};
// var address8 = {id: 314, agent: 'bla', address: 0xA1B0d2152E36ebd2ac8e4FC3309cF093444B1F5c};
// var address9 = {id: 172, agent: '33la', address: 0x4DD1680B58B821C5c631f56D9280Ccc9c4051377};

// // var x = ["a","b","c","t"];
// // var y = ["d","a","t","e","g"];
// var x = [address1,address2,address3,address4, address5, address6, address7];
// var y = [address2, address5, addressx, address8, address9];



// let myArray = y.filter( el => {
  
//   if (x.indexOf( el ) < 0) {
//     console.log('el address', el.address);
//     return el.address;
//   }
// });
// console.log('my array', myArray);

// let historicalDemand = [
//     [1.432789,2.342789],
//     [2.234679,3.4372809],
//     [3,4.437289],
//     [4,5.547389],
//     [5,6.437289],
//     [6,7.123578],
//     [8,9.1623785],
//     [12,3.1723489],
//     [43,65]
// ]
// function predictorRandom(row){
//     let timeInterval = 5;
//         let randomArray = new Array();
//         if( row <= timeInterval){
//             return historicalDemand[row];
//         }
//         for(i=row-timeInterval; i < row; i++){
//             randomArray.push(historicalDemand[i][1]);
//         }
//         return randomArray[Math.floor(Math.random() * randomArray.length)];
// }
// function predictorAverage(){
//     let timeInterval = 5; //5 hours of time interval
//     let averageArray = new Array();
//     let timeRow = 6;

//     if( timeRow <= timeInterval){
//         console.log('predictor average return value', historicalDemand[timeRow])
//         return historicalDemand[timeRow][1];
//     }

//     for(let i= timeRow-timeInterval; i < timeRow; i++){
//         averageArray.push(historicalDemand[i][1]);
//     }
//     console.log('average array', averageArray);
//     return averageArray.reduce((a, b) => a + b, 0)/timeInterval;
// }
// console.log(predictorAverage());



