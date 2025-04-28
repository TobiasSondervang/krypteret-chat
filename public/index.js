document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fuldt indlæst, tjekker elementer...');

  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const messageForm = document.querySelector('#message-form');
  const folderForm = document.querySelector('#folder-form');
  const logoutButton = document.querySelector('#logout-button');
  const loginSection = document.querySelector('#login-section');
  const appSection = document.querySelector('#app-section');
  const folderMessagesSection = document.querySelector('#folder-messages-section');

  if (!loginForm || !registerForm || !messageForm || !folderForm || !logoutButton || !loginSection || !appSection || !folderMessagesSection) {
    console.error('Et eller flere kritiske elementer mangler i DOM');
    return;
  }

  let currentUserEmail = localStorage.getItem('currentUserEmail');

  // Tjek login status
  if (currentUserEmail) {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    folderMessagesSection.style.display = 'none';
    console.log('Bruger logget ind:', currentUserEmail);
    getFolders();
    getMessages();
  } else {
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
    folderMessagesSection.style.display = 'none';
    console.log('Ingen bruger logget ind');
  }

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#login-email').value;
    const password = document.querySelector('#login-password').value;
    try {
      const response = await fetch('/functions/chat', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Login respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig JSON-respons fra serveren');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      currentUserEmail = email;
      localStorage.setItem('currentUserEmail', email);
      loginSection.style.display = 'none';
      appSection.style.display = 'block';
      console.log('Bruger logget ind:', email);
      getFolders();
      getMessages();
    } catch (error) {
      console.error('Login fejl:', error);
      alert('Login mislykkedes: ' + error.message);
    }
  });

  // Registrering
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#register-email').value;
    const password = document.querySelector('#register-password').value;
    try {
      const response = await fetch('/functions/chat', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', email, password }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Registrering respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig JSON-respons fra serveren');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      currentUserEmail = email;
      localStorage.setItem('currentUserEmail', email);
      loginSection.style.display = 'none';
      appSection.style.display = 'block';
      console.log('Bruger registreret:', email);
      getFolders();
      getMessages();
    } catch (error) {
      console.error('Registreringsfejl:', error);
      alert('Registrering mislykkedes: ' + error.message);
    }
  });

  // Logout
  logoutButton.addEventListener('click', () => {
    currentUserEmail = null;
    localStorage.removeItem('currentUserEmail');
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
    folderMessagesSection.style.display = 'none';
    console.log('Bruger logget ud');
  });

  // Send besked
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.querySelector('#message-content').value;
    const recipients = document.querySelector('#message-recipients').value.split(',').map(r => r.trim());
    const secretKey = document.querySelector('#message-secret-key').value;

    if (!content || !recipients.length || !secretKey || !currentUserEmail) {
      console.error('Manglende beskedoplysninger eller bruger ikke logget ind');
      alert('Udfyld alle felter og log ind');
      return;
    }

    try {
      const encryptedContent = CryptoJS.AES.encrypt(content, secretKey).toString();
      for (const recipient of recipients) {
        const response = await fetch('/functions/chat', {
          method: 'POST',
          body: JSON.stringify({
            sender: currentUserEmail,
            recipient: recipient,
            content: encryptedContent
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('Besked respons status:', response.status, response.statusText);
        const rawResponse = await response.text();
        console.log('Rå respons:', rawResponse);

        let result;
        try {
          result = JSON.parse(rawResponse);
        } catch (jsonError) {
          console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
          throw new Error('Ugyldig JSON-respons fra serveren');
        }

        if (!response.ok) {
          throw new Error(result.error || `Serverfejl: ${response.status}`);
        }
      }

      console.log('Besked sendt succesfuldt');
      document.querySelector('#message-content').value = '';
      document.querySelector('#message-recipients').value = '';
      document.querySelector('#message-secret-key').value = '';
      getMessages();
    } catch (error) {
      console.error('Fejl ved afsendelse:', error);
      alert('Kunne ikke sende besked: ' + error.message);
    }
  });

  // Opret folder
  folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folderName = document.querySelector('#folder-name').value;

    if (!folderName || !currentUserEmail) {
      console.error('Manglende foldernavn eller bruger ikke logget ind');
      alert('Udfyld foldernavn og log ind');
      return;
    }

    try {
      const response = await fetch('/functions/chat', {
        method: 'POST',
        body: JSON.stringify({
          action: 'createFolder',
          email: currentUserEmail,
          folderName
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Folder respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig JSON-respons fra serveren');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      console.log('Folder oprettet:', folderName);
      document.querySelector('#folder-name').value = '';
      getFolders();
    } catch (error) {
      console.error('Fejl ved oprettelse af folder:', error);
      alert('Kunne ikke oprette folder: ' + error.message);
    }
  });
});

async function getFolders() {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke hente foldere');
    return;
  }

  try {
    const response = await fetch(
      `/functions/chat?action=getFolders&email=${encodeURIComponent(currentUserEmail)}`
    );

    console.log('Get folders respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let folders;
    try {
      folders = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig JSON-respons fra serveren');
    }

    console.log('Hentede foldere:', folders);

    const foldersDiv = document.querySelector('#folders');
    if (foldersDiv) {
      foldersDiv.innerHTML = '<h3 class="text-xl font-bold mb-2">Folders</h3>';
      folders.forEach(folder => {
        const folderLink = document.createElement('div');
        folderLink.innerHTML = `<a href="#" class="folder-link" data-folder="${folder}">${folder}</a>`;
        foldersDiv.appendChild(folderLink);
      });

      document.querySelectorAll('.folder-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const folderName = e.target.dataset.folder;
          showFolderMessages(folderName);
        });
      });
    } else {
      console.error('Folder container (#folders) blev ikke fundet');
    }
  } catch (error) {
    console.error('Fejl ved hentning af foldere:', error);
  }
}

async function getMessages() {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke hente beskeder');
    return;
  }

  try {
    const response = await fetch(
      `/functions/chat?action=getMessages&email=${encodeURIComponent(currentUserEmail)}`
    );

    console.log('Get messages respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let messages;
    try {
      messages = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig JSON-respons fra serveren');
    }

    console.log('Hentede beskeder:', messages);

    const messagesDiv = document.querySelector('#messages');
    if (messagesDiv) {
      messagesDiv.innerHTML = '<h3 class="text-xl font-bold mb-2">Messages</h3>';
      messages.forEach(msg => {
        const li = document.createElement('div');
        li.innerHTML = `
          ${msg.content}
          <button class="decryptButton" data-message-id="${msg._id}" data-content="${msg.content}">Dekrypt</button>
        `;
        messagesDiv.appendChild(li);
      });
    } else {
      console.error('Besked container (#messages) blev ikke fundet');
    }
  } catch (error) {
    console.error('Fejl ved hentning af beskeder:', error);
  }
}

async function showFolderMessages(folderName) {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke hente folder beskeder');
    return;
  }

  document.querySelector('#app-section').style.display = 'none';
  document.querySelector('#folder-messages-section').style.display = 'block';

  try {
    const response = await fetch(
      `/functions/chat?action=getFolderMessages&email=${encodeURIComponent(currentUserEmail)}&folderName=${encodeURIComponent(folderName)}`
    );

    console.log('Get folder messages respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let messages;
    try {
      messages = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig JSON-respons fra serveren');
    }

    console.log(`Hentede beskeder for folder ${folderName}:`, messages);

    const folderMessagesDiv = document.querySelector('#folder-messages');
    if (folderMessagesDiv) {
      folderMessagesDiv.innerHTML = `<h3 class="text-xl font-bold mb-2">${folderName} Messages</h3>`;
      messages.forEach(msg => {
        const li = document.createElement('div');
        li.innerHTML = `
          ${msg.content}
          <button class="decryptButton" data-message-id="${msg._id}" data-content="${msg.content}">Dekrypt</button>
        `;
        folderMessagesDiv.appendChild(li);
      });
    } else {
      console.error('Folder besked container (#folder-messages) blev ikke fundet');
    }
  } catch (error) {
    console.error(`Fejl ved hentning af ${folderName} beskeder:`, error);
  }
}

function showApp() {
  document.querySelector('#app-section').style.display = 'block';
  document.querySelector('#folder-messages-section').style.display = 'none';
}

function decryptMessage(messageId, encryptedContent) {
  console.log('Dekrypterer besked ID:', messageId);
  try {
    const key = prompt('Indtast dekrypteringsnøgle');
    if (!key) throw new Error('Ingen nøgle angivet');
    const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Ugyldig nøgle eller indhold');
    console.log('Dekrypteret besked:', decrypted);
    alert('Dekrypteret besked: ' + decrypted);
    return decrypted;
  } catch (error) {
    console.error('Dekrypteringsfejl:', error);
    alert('Dekryptering mislykkedes: ' + error.message);
    return null;
  }
}

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('decryptButton')) {
    console.log('Dekrypt-knap klikket');
    const messageId = event.target.dataset.messageId;
    const encryptedContent = event.target.dataset.content;
    decryptMessage(messageId, encryptedContent);
  }
});