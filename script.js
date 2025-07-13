
let wallet = null;
let client = null;
let isConnected = false;
let pendingTransaction = null;

// DOM Elements
const topBalance = document.getElementById('topBalance');
const topAddress = document.getElementById('topAddress');
const topStatus = document.getElementById('topStatus');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const walletActions = document.getElementById('walletActions');
const walletDetails = document.getElementById('walletDetails');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const accountInfoPanel = document.getElementById('accountInfoPanel');
const accountInfoGrid = document.getElementById('accountInfoGrid');
const transactionHistoryPanel = document.getElementById('transactionHistoryPanel');
const transactionGrid = document.getElementById('transactionGrid');
const transactionModal = document.getElementById('transactionModal');
const previewGrid = document.getElementById('previewGrid');

// Utility Functions
function rippleTimeToUnixTime(rippleTime) {
    return (rippleTime + 0x386D4380) * 1000;
}

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showModal() {
    transactionModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    transactionModal.classList.remove('show');
    document.body.style.overflow = '';
    pendingTransaction = null;
}

function updateTopBar() {
    if (wallet && isConnected) {
        topAddress.textContent = `${wallet.address.substring(0, 8)}...${wallet.address.substring(-6)}`;
        topStatus.classList.add('connected');
    } else {
        topAddress.textContent = 'Not Connected';
        topStatus.classList.remove('connected');
        topBalance.textContent = '0 XRP';
    }
}

// XRPL Client Management
async function initializeClient() {
    if (!client) {
        if (typeof xrpl === 'undefined') {
            await new Promise(resolve => {
                const checkXRPL = () => {
                    if (typeof xrpl !== 'undefined') {
                        resolve();
                    } else {
                        setTimeout(checkXRPL, 100);
                    }
                };
                checkXRPL();
            });
        }
        client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
        try {
            await client.connect();
            console.log('XRPL client connected.');
        } catch (error) {
            console.error('Failed to connect XRPL client:', error);
            addMessage('❌ Failed to connect to XRP Ledger. Please check your network connection.', 'system');
            throw error;
        }
    } else if (!client.isConnected()) {
        try {
            await client.connect();
            console.log('XRPL client reconnected.');
        } catch (error) {
            console.error('Failed to reconnect XRPL client:', error);
            addMessage('❌ Failed to reconnect to XRP Ledger. Please check your network connection.', 'system');
            throw error;
        }
    }
}

// Wallet Functions
async function createWallet() {
    try {
        addMessage('🔄 <strong>Creating new wallet...</strong>', 'system');
        await initializeClient();

        addMessage('💰 <strong>Generating wallet and funding with test XRP...</strong>', 'system');
        wallet = xrpl.Wallet.generate();

        const fundResult = await client.fundWallet(wallet);

        await updateWalletUI();
        addMessage(`🎉 <strong>Wallet created successfully!</strong><br><br>📍 <strong>Address:</strong> <span class="address-value">${wallet.address}</span><br><br>🔑 <strong>⚠️ Save your seed phrase:</strong><br><code style="background: rgba(255, 68, 68, 0.1); color: var(--error); padding: 0.75rem; border-radius: 8px; display: block; margin: 0.5rem 0; font-family: var(--font-mono);">${wallet.seed}</code><br><small style="color: var(--text-muted);">⚠️ For testing only - never share in production!</small>`, 'system');

    } catch (error) {
        addMessage(`❌ <strong>Error creating wallet:</strong> ${error.message}`, 'system');
        console.error("Wallet creation error:", error);
    }
}

async function connectWallet() {
    const seed = prompt('🔑 Enter your wallet seed phrase (starts with s...):');
    if (!seed) {
        addMessage('❌ Connection cancelled.', 'system');
        return;
    }

    try {
        addMessage('🔄 <strong>Connecting wallet...</strong>', 'system');
        await initializeClient();

        wallet = xrpl.Wallet.fromSeed(seed);

        await updateWalletUI();
        addMessage('✅ <strong>Wallet connected successfully!</strong> 🎉', 'system');

    } catch (error) {
        addMessage(`❌ <strong>Error connecting wallet:</strong> ${error.message}`, 'system');
        console.error("Wallet connection error:", error);
    }
}

async function disconnectWallet() {
    if (client && client.isConnected()) {
        await client.disconnect();
    }

    wallet = null;
    isConnected = false;

    // Update UI
    statusIcon.innerHTML = '<i class="fas fa-unlink"></i>';
    statusIcon.classList.remove('connected');
    statusText.textContent = 'Wallet Disconnected';
    walletActions.style.display = 'grid';
    walletDetails.classList.remove('show');
    chatInput.disabled = true;
    sendButton.disabled = true;
    chatInput.placeholder = 'Connect your wallet to start sending XRP...';

    // Update top bar
    updateTopBar();

    // Hide info panels
    accountInfoPanel.classList.remove('show');
    transactionHistoryPanel.classList.remove('show');

    addMessage('👋 <strong>Wallet disconnected.</strong> Connect or create a new wallet to continue.', 'system');
}

async function updateWalletUI() {
    if (!wallet) return;

    isConnected = true;
    statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    statusIcon.classList.add('connected');
    statusText.textContent = 'Wallet Connected';
    walletActions.style.display = 'none';
    walletDetails.classList.add('show');
    walletAddress.textContent = wallet.address;
    chatInput.disabled = false;
    sendButton.disabled = false;
    chatInput.placeholder = 'Type your transaction request... (e.g., "Send 10 XRP to rN7n7...")';

    // Update top bar
    updateTopBar();

    // Hide info panels
    accountInfoPanel.classList.remove('show');
    transactionHistoryPanel.classList.remove('show');

    await refreshBalance();
}

async function refreshBalance() {
    if (!wallet || !client) return;

    try {
        const response = await client.request({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
        });
        const balance = xrpl.dropsToXrp(response.result.account_data.Balance);
        walletBalance.textContent = `${balance} XRP`;
        topBalance.textContent = `${balance} XRP`;

        addMessage(`💰 <strong>Balance updated:</strong> ${balance} XRP`, 'system');
    } catch (error) {
        walletBalance.textContent = '0 XRP';
        topBalance.textContent = '0 XRP';
        console.error("Error fetching balance:", error);
    }
}

// Transaction Functions
function parseTransaction(input) {
    const result = {};

    const amountMatch = input.match(/(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*xrp/i);
    if (amountMatch) {
        result.amount = parseFloat(amountMatch[1]);
    }

    const destMatch = input.match(/(?:to|destination)\s+([rR][a-zA-Z0-9]{24,34})/i);
    if (destMatch) {
        result.destination = destMatch[1];
    }

    const tagMatch = input.match(/(?:tag|destination\s+tag)\s+(\d+)/i);
    if (tagMatch) {
        result.destinationTag = parseInt(tagMatch[1], 10);
    }

    const memoMatch = input.match(/(?:memo|note|message)\s+['"](.*?)['"]|(?:memo|note|message)\s+(\S+)/i);
    if (memoMatch) {
        result.memo = memoMatch[1] || memoMatch[2];
    }

    return result;
}

function showTransactionPreview(data) {
    if (!data.amount || !data.destination) {
        addMessage('❌ <strong>Missing required information.</strong> Please specify both amount and destination address.', 'system');
        return;
    }

    pendingTransaction = data;

    // Calculate fees
    const networkFee = 0.00001;
    const totalAmount = data.amount + networkFee;

    let previewHTML = '';

    previewHTML += `
                <div class="preview-card">
                    <span class="preview-label">💸 Amount</span>
                    <span class="preview-value accent">${data.amount} XRP</span>
                </div>
            `;

    previewHTML += `
                <div class="preview-card">
                    <span class="preview-label">📍 To Address</span>
                    <span class="preview-value address-value">${data.destination}</span>
                </div>
            `;

    if (data.destinationTag) {
        previewHTML += `
                    <div class="preview-card">
                        <span class="preview-label">🏷️ Destination Tag</span>
                        <span class="preview-value">${data.destinationTag}</span>
                    </div>
                `;
    }

    if (data.memo) {
        previewHTML += `
                    <div class="preview-card">
                        <span class="preview-label">📝 Memo</span>
                        <span class="preview-value">${data.memo}</span>
                    </div>
                `;
    }

    previewHTML += `
                <div class="preview-card">
                    <span class="preview-label">⚡ Network Fee</span>
                    <span class="preview-value">${networkFee} XRP</span>
                </div>
            `;

    previewHTML += `
                <div class="preview-card total">
                    <span class="preview-label" style="font-weight: 700;">💳 Total Deduction</span>
                    <span class="preview-value total">${totalAmount} XRP</span>
                </div>
            `;

    previewGrid.innerHTML = previewHTML;
    showModal();
}

async function confirmTransaction() {
    if (!pendingTransaction) {
        addMessage('❌ No pending transaction to confirm.', 'system');
        hideModal();
        return;
    }

    const data = { ...pendingTransaction };
    hideModal();

    try {
        addMessage('🔄 <strong>Processing transaction...</strong> Please wait...', 'system');

        const payment = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Amount: xrpl.xrpToDrops(data.amount),
            Destination: data.destination
        };

        if (data.destinationTag) {
            payment.DestinationTag = data.destinationTag;
        }

        if (data.memo) {
            payment.Memos = [{
                Memo: {
                    MemoData: Buffer.from(data.memo, 'utf8').toString('hex').toUpperCase()
                }
            }];
        }

        const prepared = await client.autofill(payment);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            addMessage(`🎉 <strong>Transaction Successful!</strong><br><br>📋 <strong>Hash:</strong> <a href="https://testnet.xrpl.org/transactions/${result.result.hash}" target="_blank" style="color: var(--accent-primary); text-decoration: none;">${result.result.hash.substring(0, 20)}... <i class="fas fa-external-link-alt"></i></a><br>💸 <strong>Sent:</strong> ${data.amount} XRP<br>📍 <strong>To:</strong> <span class="address-value">${data.destination}</span>`, 'system');

            // Update balance after successful transaction
            await refreshBalance();
        } else {
            addMessage(`❌ <strong>Transaction failed:</strong> ${result.result.meta.TransactionResult}`, 'system');
        }

    } catch (error) {
        addMessage(`❌ <strong>Transaction error:</strong> ${error.message}`, 'system');
        console.error("Transaction error:", error);
    }
}

function cancelTransaction() {
    addMessage('❌ <strong>Transaction cancelled.</strong>', 'system');
    hideModal();
}

// Info Functions
async function getAccountInfo() {
    if (!wallet) {
        addMessage('❌ Please connect your wallet first.', 'system');
        return;
    }

    try {
        addMessage('🔄 <strong>Fetching account information...</strong>', 'system');
        const response = await client.request({
            command: 'account_info',
            account: wallet.address
        });
        const data = response.result.account_data;

        let infoHTML = `
                    <div class="info-item">
                        <span class="info-label">📍 Account Address</span>
                        <span class="info-value address-value">${data.Account}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💰 Current Balance</span>
                        <span class="info-value" style="color: var(--accent-primary); font-weight: 700;">${xrpl.dropsToXrp(data.Balance)} XRP</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🔢 Sequence Number</span>
                        <span class="info-value">${data.Sequence}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📊 Account Type</span>
                        <span class="info-value">${data.LedgerEntryType}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🌐 Network</span>
                        <span class="info-value" style="color: var(--info);">XRP Ledger Testnet</span>
                    </div>
                `;

        if (data.RegularKey) {
            infoHTML += `
                        <div class="info-item">
                            <span class="info-label">🔑 Regular Key</span>
                            <span class="info-value address-value">${data.RegularKey}</span>
                        </div>
                    `;
        }

        accountInfoGrid.innerHTML = infoHTML;
        accountInfoPanel.classList.add('show');
        transactionHistoryPanel.classList.remove('show');
        addMessage('✅ <strong>Account information loaded successfully!</strong>', 'system');
    } catch (error) {
        addMessage(`❌ <strong>Error fetching account info:</strong> ${error.message}`, 'system');
        console.error("Account info error:", error);
    }
}

async function getTransactionHistory() {
    if (!wallet) {
        addMessage('❌ Please connect your wallet first.', 'system');
        return;
    }

    try {
        addMessage('🔄 <strong>Fetching transaction history...</strong>', 'system');
        const response = await client.request({
            command: 'account_tx',
            account: wallet.address,
            limit: 20
        });

        let historyHTML = '';

        if (response.result.transactions && response.result.transactions.length > 0) {
            response.result.transactions.forEach(entry => {
                const tx = entry.tx || entry.tx_json;
                const meta = entry.meta;

                if (!tx || !meta) {
                    return;
                }

                let type = tx.TransactionType;
                let amount = '-';
                let relatedAddress = '';
                let iconClass = 'fas fa-exchange-alt';
                let amountClass = '';

                if (tx.TransactionType === 'Payment') {
                    if (tx.Amount) {
                        if (typeof tx.Amount === 'string') {
                            amount = `${xrpl.dropsToXrp(tx.Amount)} XRP`;
                        } else if (typeof tx.Amount === 'object' && tx.Amount.value) {
                            amount = `${tx.Amount.value} ${tx.Amount.currency}`;
                        }
                    }

                    if (tx.Destination && tx.Destination !== wallet.address) {
                        relatedAddress = `${tx.Destination.substring(0, 12)}...${tx.Destination.substring(-6)}`;
                        type = 'Sent Payment';
                        amount = '-' + amount;
                        iconClass = 'fas fa-arrow-up';
                        amountClass = 'negative';
                    } else if (tx.Account && tx.Account !== wallet.address) {
                        relatedAddress = `${tx.Account.substring(0, 12)}...${tx.Account.substring(-6)}`;
                        type = 'Received Payment';
                        amount = '+' + amount;
                        iconClass = 'fas fa-arrow-down';
                        amountClass = 'positive';
                    } else {
                        relatedAddress = tx.hash ? `${tx.hash.substring(0, 16)}...` : 'N/A';
                    }
                } else {
                    relatedAddress = tx.hash ? `${tx.hash.substring(0, 16)}...` : 'N/A';
                }

                const date = tx.date ? new Date(rippleTimeToUnixTime(tx.date)).toLocaleDateString() : 'N/A';

                historyHTML += `
                            <div class="transaction-card">
                                <div class="tx-icon ${amountClass === 'positive' ? 'received' : 'sent'}">
                                    <i class="${iconClass}"></i>
                                </div>
                                <div class="tx-details">
                                    <div class="tx-type">${type}</div>
                                    <div class="tx-address">${relatedAddress}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${date}</div>
                                </div>
                                <div class="tx-amount ${amountClass}">${amount}</div>
                            </div>
                        `;
            });
            addMessage('✅ <strong>Transaction history loaded successfully!</strong>', 'system');
        } else {
            historyHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
                            <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                            <div>No transactions found</div>
                        </div>
                    `;
            addMessage('ℹ️ <strong>No transaction history found</strong> for this account.', 'system');
        }

        transactionGrid.innerHTML = historyHTML;
        transactionHistoryPanel.classList.add('show');
        accountInfoPanel.classList.remove('show');
    } catch (error) {
        addMessage(`❌ <strong>Error fetching transaction history:</strong> ${error.message}`, 'system');
        console.error("Transaction history error:", error);
    }
}

// Event Listeners
sendButton.addEventListener('click', function () {
    const userInput = chatInput.value.trim();
    if (userInput) {
        addMessage(userInput, 'user');
        chatInput.value = '';

        if (!isConnected) {
            addMessage('❌ <strong>Please connect your wallet first</strong> to send transactions.', 'system');
            return;
        }

        if (userInput.toLowerCase().includes('account info') || userInput.toLowerCase().includes('balance')) {
            getAccountInfo();
            return;
        }

        if (userInput.toLowerCase().includes('transaction history') || userInput.toLowerCase().includes('past transactions')) {
            getTransactionHistory();
            return;
        }

        const parsedData = parseTransaction(userInput);

        if (!parsedData.amount || !parsedData.destination) {
            addMessage('❌ <strong>I couldn\'t understand your request.</strong><br><br>Please specify both the <strong>amount</strong> (e.g., "10 XRP") and the <strong>destination address</strong> (e.g., "rN7n7otELRKCpo4KJkNgSfCxp4oTajWjZn").<br><br><em>💡 Try: "Send 25 XRP to rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY"</em>', 'system');
        } else {
            showTransactionPreview(parsedData);
        }
    }
});

chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !sendButton.disabled) {
        sendButton.click();
    }
});

// Close modal when clicking outside
transactionModal.addEventListener('click', function (e) {
    if (e.target === transactionModal) {
        cancelTransaction();
    }
});

// Initialize
window.addEventListener('load', async function () {
    try {
        await initializeClient();
    } catch (error) {
        console.error('Failed to initialize client on load:', error);
    }
});

window.addEventListener('beforeunload', function () {
    if (client && client.isConnected()) {
        client.disconnect();
    }
});
