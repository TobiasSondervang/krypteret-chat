const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const messageForm = document.getElementById('message-form');
const folderForm = document.getElementById('folder-form');
const logoutButton = document.getElementById('logout-button');
const foldersDiv = document.getElementById('folders');
const messagesDiv = document.getElementById('messages');
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('user');
    if (user) {
        currentUser = JSON.parse(user);
        showApp();
        fetchFolders();
        fetchMessages();
    } else {
        showLogin();
    }
});

function showLogin() {
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
}

function showApp() {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
        });
        const result = await response.json();
        console.log('Login response:', result);

        if (result.success) {
            currentUser = result.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showApp();
            fetchFolders();
            fetchMessages();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error logging in');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', email, password })
        });
        const result = await response.json();
        console.log('Register response:', result);

        if (result.success) {
            alert('User registered! Please log in.');
            registerForm.reset();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('Error registering');
    }
});

logoutButton.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('user');
    showLogin();
});

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('message-content').value;
    const recipients = document.getElementById('message-recipients').value.split(',').map(r => r.trim());
    const secretKey = document.getElementById('message-secret-key').value;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sendMessage',
                email: currentUser.email,
                message,
                recipients,
                secretKey
            })
        });
        const result = await response.json();
        console.log('Send message response:', result);

        if (result.success) {
            messageForm.reset();
            fetchMessages();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Send message error:', error);
        alert('Error sending message');
    }
});

folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folderName = document.getElementById('folder-name').value;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createFolder',
                email: currentUser.email,
                folderName
            })
        });
        const result = await response.json();
        console.log('Create folder response:', result);

        if (result.success) {
            folderForm.reset();
            fetchFolders();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Create folder error:', error);
        alert('Error creating folder');
    }
});

async function fetchFolders() {
    try {
        const response = await fetch(`/chat?action=getFolders&email=${encodeURIComponent(currentUser.email)}`);
        const result = await response.json();
        console.log('Fetch folders response:', result);

        if (result.success) {
            foldersDiv.innerHTML = '<h3>Folders</h3><ul>' + result.folders.map(f => `<li>${f.folderName}</li>`).join('') + '</ul>';
        } else {
            foldersDiv.innerHTML = `<p>Error: ${result.error}</p>`;
        }
    } catch (error) {
        console.error('Fetch folders error:', error);
        foldersDiv.innerHTML = '<p>Error loading folders</p>';
    }
}

async function fetchMessages() {
    try {
        const response = await fetch(`/chat?action=getMessages&email=${encodeURIComponent(currentUser.email)}`);
        const result = await response.json();
        console.log('Fetch messages response:', result);

        if (result.success) {
            messagesDiv.innerHTML = '<h3>Messages</h3><ul>';
            for (const msg of result.messages) {
                const li = document.createElement('li');
                li.textContent = `From: ${msg.sender}, Encrypted: ${msg.content.substring(0, 20)}...`;
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Enter secret key';
                const button = document.createElement('button');
                button.textContent = 'Decrypt';
                button.onclick = () => {
                    try {
                        const decrypted = decryptMessage(msg.content, input.value);
                        li.textContent = `From: ${msg.sender}, Message: ${decrypted}`;
                    } catch (e) {
                        li.textContent = `From: ${msg.sender}, Error: Invalid key`;
                    }
                };
                li.appendChild(input);
                li.appendChild(button);
                messagesDiv.appendChild(li);
            }
            messagesDiv.innerHTML += '</ul>';
        } else {
            messagesDiv.innerHTML = `<p>Error: ${result.error}</p>`;
        }
    } catch (error) {
        console.error('Fetch messages error:', error);
        messagesDiv.innerHTML = '<p>Error loading messages</p>';
    }
}

function decryptMessage(encrypted, secretKey) {
    const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
}
