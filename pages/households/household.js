import React, { Component } from 'react';
import Layout from '../../components/Layout';
import SupplyEtherForm from '../../components/SupplyEtherForm';
import { Card, Grid, Button, Table} from 'semantic-ui-react';
import { Link } from '../../routes';
import HouseholdContract from '../../ethereum/household';
import web3 from '../../ethereum/web3';
import SetExchange from '../../components/SetExchange';
import SubmitBidInput from '../../components/SubmitBidInput';
import SubmitSellInput from '../../components/SubmitSellInput';
import BidsRow from '../../components/BidsRow';

class HouseholdPage extends Component {
    static async getInitialProps(props) {
        const household = HouseholdContract(props.query.address);
        const summary = await household.methods.getSmartMeterDetails().call();
        const balance = await web3.eth.getBalance(props.query.address);
        const exchangeAddress = await household.methods.exchangeAddress().call();

        let bidsCount = await household.methods.getBidsCount().call();
        let asksCount = await household.methods.getAsksCount().call();

        let bidsTemp = new Array();
        let asksTemp = new Array();
        
        for(let i=0; i < bidsCount; i++){
            let bid = await household.methods.getBid(i).call();
            bidsTemp[i] = parseInt(bid['2'], 10);
        }
        for(let i=0; i < asksCount; i++){
            let ask = await household.methods.getAsk(i).call();
            asksTemp[i] = parseInt(ask['2'], 10);
        }

     
        const sumBids = bidsTemp.reduce((a, b) => a + b, 0);
        const sumAsks = asksTemp.reduce((a,b) => a + b, 0);
        console.log('sumbids', sumBids);
        console.log('sumasks', sumAsks);


        const bids = await Promise.all(
            Array(parseInt(bidsCount)).fill().map((element, index) => {
                return household.methods.getBid(index).call()
            })
        );

        const asks = await Promise.all(
            Array(parseInt(asksCount)).fill().map((element, index) => {
                return household.methods.getAsk(index).call()
            })
        );
        
        return { 
            owner: summary[0],
            address: props.query.address,
            demand: summary[1],
            supply: summary[2],
            batteryCapacity: summary[3],
            amountOfCharge: summary[4],
            excessEnergy: summary[5],
            balance: balance,
            exchangeAddress: exchangeAddress,
            bids: bids,
            asks: asks,
            sumBids: sumBids,
            sumAsks: sumAsks,
            bidsCount: bidsCount,
            asksCount: asksCount
        }
    }

    renderCards(){
        const {
            owner,
            demand,
            supply,
            batteryCapacity,
            amountOfCharge,
            excessEnergy,
            balance,
            exchangeAddress
          } = this.props;
      
          const items = [
            {
              header: owner,
              meta: 'Address of Owner',
              description:
                'The owner created this contract and can submit Bids and Asks to the exchange',
              style: { overflowWrap: 'break-word' }
            },
            {
              header: this.props.address,
              meta: 'Address of the Household Contract',
              description:
                'This address serves as an identification of the household contract. It can be used to send ether to if someone desires to buy electricity from it.',
              style: { overflowWrap: 'break-word' }
            },
            {
              header: demand,
              meta: 'Current Demand of Household',
              description:
                'Current demand indicates the load of the household in Wh'
            },
            {
              header: supply,
              meta: 'Current Supply of Household',
              description:
                'Current supply indicates the generation of the household in Wh'
            },
            {
                header: batteryCapacity,
                meta: 'Battery Capacity of the Household',
                description:
                  'The full battery capacity of the household in Wh.'
            },
            {
                header: amountOfCharge,
                meta: 'Current Amount of Charge of the Battery',
                description:
                  'Current amount of charge of the battery of the household in Wh.'
            },
            {
                header: excessEnergy,
                meta: 'Current Excess of Energy of the Household',
                description:
                  'Current excess of energy being generated by the household in Wh.'
            },
            {
              header: web3.utils.fromWei(balance, 'ether'),
              meta: 'Household Contract Balance (ether)',
              description:
                'The balance is how much ether a household contract holds.'
            },
            {
                header: exchangeAddress,
                meta: 'Exchange Address',
                description:
                  'The address of the exchange in which this contract is connected to.',
                  style: { overflowWrap: 'break-word' }
            }
            ];
            return <Card.Group items={items} />;
    }

    renderBuyRows() {
        return this.props.bids.map((bids, index) => {
            return <BidsRow 
              id={index}
              bids={bids}
              address={this.props.address}
              bidsCount={this.props.bidsCount}
            />;
        })
    }

    renderAskRows(){
        return this.props.asks.map((asks, index) => {
            return <AsksRow 
              id={index}
              asks={asks}
              address={this.props.address}
              bidsCount={this.props.asksCount}
            />;
        })
    }

    render() {
        const {Header, Row, HeaderCell, Body } = Table;

        return (
            <Layout>
                <h2>Household Page Summary</h2>
                <Link route={'exchange'} params={{ address : this.props.address}}>
                <Button position='right' secondary>Go to Exchange</Button>
                </Link>
                <Grid style={{ marginTop: '10px', marginBottom: '10px' }}>
                    <Grid.Row>
                    <Grid.Column width={10}>{this.renderCards()}</Grid.Column>
                    <Grid.Column width={6}>
                    <SupplyEtherForm address={this.props.address} style={{padding:'10', marginBottom: '100px'}}/>
                    <p></p>
                    <p></p>
                    <SetExchange address={this.props.address} style={{marginTop: '10px'}}/>
                    </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>

                        <h3>Buy Orderbook (Historical)</h3>
                        <Table>
                            <Header>
                                <Row>
                                    <HeaderCell>ID</HeaderCell>
                                    <HeaderCell>From address</HeaderCell>
                                    <HeaderCell>Amount</HeaderCell>
                                    <HeaderCell>Price</HeaderCell>
                                    <HeaderCell>Date</HeaderCell>
                                </Row>
                            </Header>
                            <Body>
                                {this.renderBuyRows()} 
                            </Body>
                        </Table>
                        <div>There are {this.props.bidsCount} bids.</div>
                        <div>Buying Volume is {this.props.sumBids} W/h.</div>
                        <p></p>
                        <p></p>
                        <h3>Ask Order Book (Historical)</h3>
                        <Table>
                            <Header>
                                <Row>
                                    <HeaderCell>ID</HeaderCell>
                                    <HeaderCell>From address</HeaderCell>
                                    <HeaderCell>Amount</HeaderCell>
                                    <HeaderCell>Price</HeaderCell>
                                    <HeaderCell>Date</HeaderCell>
                                </Row>
                            </Header>
                            <Body>
                                {this.renderAskRows()} 
                            </Body>
                        </Table>
                        <div>There are {this.props.asksCount} asks.</div>
                        <div>Buying Volume is {this.props.sumAsks} W/h.</div>


                    </Grid.Row>
                </Grid>
                
            </Layout>
        );
    }
}

export default HouseholdPage;