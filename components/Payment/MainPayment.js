const { 
  BigNumber
} = require('0x.js');
const {
  Web3Wrapper
} = require('@0xproject/web3-wrapper');
import React, { Component } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { startLoading, stopLoading, showModal, closeModal } from '../../store/actions/ui';
import Navbar from './Navbar';
import NavbarPaymentPrice from './NavbarPaymentPrice';
import SelectToken from '../common/SelectToken';
import DetailPayment from './DetailPayment';
import TextButton from '../common/TextButton';
import { connect } from 'react-redux';
import LoadingIndicator from '../common/LoadingIndicator';
import { ERC20_MAP } from '../../web3/util/addresses';
import web3 from '../../web3';
import { getContractInstance } from '../../web3/contracts/utils';
import { STABLEPAY, DAI, ZRXTOKEN } from '../../web3/util/addresses'
import { loadBalance } from '../../store/actions/token';
import { getTokenAmount, toBaseUnitAmount } from '../../web3/util/tokenUtils';
import { UNLIMITED_ALLOWANCE_IN_BASE_UNITS, DECIMALS } from '../../web3/util/constants';
import CircularIndetermiante from '../common/CircularIndetermiante';
import SelectWallet from '../common/SelectWallet';

//import { BigNumber } from 'web3';

const BASE_API_URL = 'https://www.mocky.io/v2/';
const ETH_ORDER_API = '5bba3fa83100008600148c3f';
const ZRX_ORDER_API = '5bba3f223100005600148c3d';

const styles = theme => ({
  root: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  button: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '30px', 
  }, 

});

// to use const stablePay = getContractInstance('StablePay', STABLEPAY);

class MainPayment extends Component {
  state = {
    tokenName: null,
    tokenAddress: null,
    tokenBalance: null,
    tokenAmount: null,
    currentAccount: null,
    signedOrder: null,
    receiverAccount: '0xe1f8fea4699ce3e0196923e6fa16f773600e59e0',
  }

  async componentDidMount() {
    const accounts = await web3.eth.getAccounts();
    this.setState({currentAccount: accounts[0] });
  }

  async fetchOrder (apiOrderId) {
    const orderUrl = `${BASE_API_URL}${apiOrderId}`;
    console.log(orderUrl);
    const res = await axios.get(orderUrl);
    console.log(res);
    return res.data;
}

  onChangeToken = async (value) => {
    this.props.startLoading();
    this.props.showModal('Looking for best price...');
    showModal('Please wait while we get you the best exchange price...');
    console.log('Token ', value);
    let balance = 0;
    let erc20 = null;
    let signedOrder = null;
    let tokenAmount = null;
    if(value === 'ETH') {
      // Option ETH selected. 
       balance = await loadBalance(null, this.state.currentAccount);
       signedOrder = await this.fetchOrder(ETH_ORDER_API);
       tokenAmount = await this.calculateTokensAmount('ethereum');
    } else {
      // Option ERC20 selected.
      erc20 = ERC20_MAP[value];
      balance = await loadBalance(erc20.address, this.state.currentAccount);
      signedOrder = await this.fetchOrder(ZRX_ORDER_API);
      tokenAmount = await this.calculateTokensAmount(erc20.code);
    }
    console.log(`Token Name:      ${value}.`);
    console.log(`Token Address:   ${JSON.stringify(erc20)}.`);
    console.log(`Token Balance:   ${balance}.`);
    console.log(`Tokens Amount:   ${tokenAmount}.`);
    console.log(`SignedOrder:`);
    console.log(signedOrder);

    this.setState({
      tokenName: value,
      tokenAddress: erc20,
      tokenBalance: balance,
      signedOrder: signedOrder,
      tokenAmount: tokenAmount
    });
    this.props.stopLoading();
    this.props.closeModal();
  }

  async calculateTokensAmount(token) {
    const tokenAmount = await getTokenAmount(5, token);
    console.log('tokenAmount ', tokenAmount);
    return tokenAmount;
  }

  _onChangeWallet(value) {
    console.log('Wallet ', value);
  }

   handleClick = async () => {
    // // to use const stablePay = getContractInstance('StablePay', STABLEPAY);
    console.log('Current State');
    console.log(this.state);

    if(this.state.tokenName === 'ETH') {
      // Using ETH
      this.props.showModal('Please wait a moment while we confirm your transaction...');
      const stablePay = getContractInstance('stablePay', STABLEPAY);

      const amount =  Web3Wrapper.toBaseUnitAmount(new BigNumber(this.state.tokenAmount), DECIMALS);

      console.log('this.state.signedOrder ', this.state.signedOrder);
      console.log('this.state.receiverAccount ', this.state.receiverAccount);
      console.log('stablePay.methods ', stablePay.methods);
      const tx = await stablePay.methods.payETH(
        this.state.signedOrder.orderArray,
        DAI,
        this.state.receiverAccount,
        amount.toString(),
        this.state.signedOrder.signature
      ).send({
        from: this.state.currentAccount,
        value: amount.toNumber(),
        gas:300000
      });

      this.props.closeModal();

    } else {
      // Using a ERC20
      console.log('this.state.tokenAddress ', this.state.tokenAddress.address);
      const token = getContractInstance('erc20', this.state.tokenAddress.address);
      console.log('currentAccount ', this.state.currentAccount);
      console.log('STABLEPAY ', STABLEPAY);
      console.log('this.state.tokenAmount ', this.state.tokenAmount);
      const amount =  Web3Wrapper.toBaseUnitAmount(new BigNumber(this.state.tokenAmount), DECIMALS);
      this.props.showModal('Please approve to allow StablePay to pay with your tokens...');
      await token.methods.approve(
        STABLEPAY,
        amount.toString()
      ).send({ from: this.state.currentAccount });

      const stablePay = getContractInstance('stablePay', STABLEPAY);

      console.log('this.state.signedOrder ', this.state.signedOrder);
      console.log('this.state.receiverAccount ', this.state.receiverAccount);
      console.log('stablePay.methods ', stablePay.methods);
      this.props.showModal('Please wait a moment while we confirm your transaction...');
      const tx = await stablePay.methods.payToken(
        this.state.signedOrder.orderArray,
        this.state.tokenAddress.address,
        DAI,
        this.state.receiverAccount,
        amount.toString(),
        this.state.signedOrder.signature
      ).send({ from: this.state.currentAccount, gas:300000 });
      console.log(tx);

      this.props.closeModal();
    }
  }; 

  render () {
    console.log('props', this.props);
    const { classes, loading, loadingMessage, openModal } = this.props;

    return (
      <div>
          <Navbar />
          <NavbarPaymentPrice      
          />
         <SelectWallet 
            WalletData={this.props.WalletData} 
            WalletBrowserData={this.props.WalletBrowserData}
            name='Wallet App Require'
            helperText='Please Select a Wallet'
            onChange={this._onChangeWallet}
          />
         <SelectToken
          data={this.props.TokenData}
          name='Token'
          helperText='Please Select token'
          onChange= {value => this.onChangeToken(value)}
          balance={this.state.tokenBalance}
          tokenName={this.state.tokenName}
        />
        <DetailPayment exchangeAmount={this.state.tokenAmount} tokenName={this.state.tokenName} />
        <div className={classes.button}>  
          <TextButton name="Confirm Payment" onClick={this.handleClick}/>
        </div>

        <LoadingIndicator show={openModal} description={loadingMessage} onClose={null}/>
        <CircularIndetermiante show={loading}/>
   
      </div>
    );
  }
 
}

MainPayment.propTypes = {
  classes: PropTypes.object.isRequired,
};
const mapStateToProps = state => ({
  WalletData: state.WalletData,
  TokenData: state.TokenData,
  WalletBrowserData: state.WalletBrowserData,
  loading: state.ui.loading,
  loadingMessage: state.ui.loadingMessage,
  openModal: state.ui.showModal
})

export default connect(mapStateToProps, {
  startLoading, stopLoading, showModal, closeModal
})(withStyles(styles)(MainPayment));