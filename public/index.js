
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

         const response = await fetch('/chat', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ action: 'login', email, password })
         });
         const result = await response.json();

         if (result.success) {
             currentUser = result.user;
             localStorage.setItem('user', JSON.stringify(currentUser));
             showApp();
             fetchFolders();
             fetchMessages();
         } else {
             alert(result.error);
         }
     });

     registerForm.addEventListener('submit', async (e) => {
         e.preventDefault();
         const email = document.getElementById('register-email').value;
         const username = document.getElementById('register-username').value;
         const password = document.getElementById('register-password').value;

         const response = await fetch('/chat', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ action: 'register', email, username, password })
         });
         const result = await response.json();

         if (result.success) {
             alert('User registered! Please log in.');
             registerForm.reset();
         } else {
             alert(result.error);
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
         const recipients = document.getElementById('message-recipients').value.split(',');
         const secretKey = document.getElementById('message-secret-key').value;

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

         if (result.success) {
             messageForm.reset();
             fetchMessages();
         } else {
             alert(result.error);
         }
     });

     folderForm.addEventListener('submit', async (e) => {
         e.preventDefault();
         const folderName = document.getElementById('folder-name').value;

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

         if (result.success) {
             folderForm.reset();
             fetchFolders();
         } else {
             alert(result.error);
         }
     });

     async function fetchFolders() {
         const response = await fetch(`/chat?action=getFolders&email=${encodeURIComponent(currentUser.email)}`);
         const result = await response.json();

         if (result.success) {
             foldersDiv.innerHTML = '<h3>Folders</h3><ul>' + result.folders.map(f => `<li>${f.folderName}</li>`).join('') + '</ul>';
         } else {
             foldersDiv.innerHTML = '<p>Error loading folders</p>';
         }
     }

     async function fetchMessages() {
         const response = await fetch(`/chat?action=getMessages&email=${encodeURIComponent(currentUser.email)}`);
         const result = await response.json();

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
             messagesDiv.innerHTML = '<p>Error loading messages</p>';
         }
     }

     function decryptMessage(encrypted, secretKey) {
         const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
         return bytes.toString(CryptoJS.enc.Utf8);
     }
