let currentUserEmail = null; // Global variabel

// Funktion til at validere adgangskode
function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!minLength) {
    return "Adgangskoden skal være mindst 8 tegn lang.";
  }
  if (!hasUpperCase) {
    return "Adgangskoden skal indeholde mindst ét stort bogstav.";
  }
  if (!hasLowerCase) {
    return "Adgangskoden skal indeholde mindst ét lille bogstav.";
  }
  if (!hasNumber) {
    return "Adgangskoden skal indeholde mindst ét tal (0-9).";
  }
  return null; // Ingen fejl
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fuldt indlæst, tjekker elementer...');

  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const messageForm = document.querySelector('#message-form');
  const folderForm = document.querySelector('#folder-form');
  const logoutButton = document.querySelector('#logout-button');
  const deleteUserButton = document.querySelector('#delete-user-button');
  const loginSection = document.querySelector('#login-section');
  const appSection = document.querySelector('#app-section');
  const folderMessagesSection = document.querySelector('#folder-messages-section');

  if (!loginForm || !registerForm || !messageForm || !folderForm || !logoutButton || !deleteUserButton || !loginSection || !appSection || !folderMessagesSection) {
    console.error('Et eller flere kritiske elementer mangler i DOM');
    alert('Fejl: Manglende elementer i brugerfladen');
    return;
  }

  // Initialiser currentUserEmail fra localStorage
  currentUserEmail = localStorage.getItem('currentUserEmail');

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

      console.log('Log ind respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig serverrespons');
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
      console.error('Log ind fejl:', error);
      alert('Log ind mislykkedes: ' + error.message);
    }
  });

  // Opret konto
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#register-email').value;
    const password = document.querySelector('#register-password').value;

    // Valider adgangskode
    const passwordError = validatePassword(password);
    if (passwordError) {
      console.warn('Adgangskodevalidering fejlede:', passwordError);
      alert(passwordError);
      return;
    }

    try {
      const response = await fetch('/functions/chat', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', email, password }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Opret konto respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig serverrespons');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      currentUserEmail = email;
      localStorage.setItem('currentUserEmail', email);
      loginSection.style.display = 'none';
      appSection.style.display = 'block';
      console.log('Bruger oprettet:', email);
      getFolders();
      getMessages();
    } catch (error) {
      console.error('Opret konto fejl:', error);
      alert('Opret konto mislykkedes: ' + error.message);
    }
  });

  // Log ud
  logoutButton.addEventListener('click', () => {
    currentUserEmail = null;
    localStorage.removeItem('currentUserEmail');
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
    folderMessagesSection.style.display = 'none';
    console.log('Bruger logget ud');
  });

  // Fjern konto
  deleteUserButton.addEventListener('click', async () => {
    if (!currentUserEmail) {
      console.warn('Ingen bruger logget ind, kan ikke slette konto');
      alert('Log ind for at slette konto');
      return;
    }

    const confirmDelete = confirm('Er du sikker på, at du vil slette din konto og alle tilknyttede mapper? Denne handling kan ikke fortrydes.');
    if (!confirmDelete) {
      console.log('Bruger annullerede sletning');
      return;
    }

    try {
      const response = await fetch('/functions/chat', {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteUser',
          email: currentUserEmail
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Fjern konto respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig serverrespons');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      console.log('Konto slettet:', currentUserEmail);
      currentUserEmail = null;
      localStorage.removeItem('currentUserEmail');
      loginSection.style.display = 'block';
      appSection.style.display = 'none';
      folderMessagesSection.style.display = 'none';
      alert('Konto og tilknyttede mapper er slettet.');
    } catch (error) {
      console.error('Fejl ved sletning af konto:', error);
      alert('Kunne ikke slette konto: ' + error.message);
    }
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
          throw new Error('Ugyldig serverrespons');
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
      console.error('Fejl ved afsendelse af besked:', error);
      alert('Kunne ikke sende besked: ' + error.message);
    }
  });

  // Opret mappe
  folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folderName = document.querySelector('#folder-name').value;

    if (!folderName || !currentUserEmail) {
      console.error('Manglende mappenavn eller bruger ikke logget ind');
      alert('Udfyld mappenavn og log ind');
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

      console.log('Opret mappe respons status:', response.status, response.statusText);
      const rawResponse = await response.text();
      console.log('Rå respons:', rawResponse);

      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch (jsonError) {
        console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
        throw new Error('Ugyldig serverrespons');
      }

      if (!response.ok) {
        throw new Error(result.error || `Serverfejl: ${response.status}`);
      }

      console.log('Mappe oprettet:', folderName);
      document.querySelector('#folder-name').value = '';
      getFolders();
    } catch (error) {
      console.error('Fejl ved oprettelse af mappe:', error);
      alert('Kunne ikke oprette mappe: ' + error.message);
    }
  });
});

async function getFolders() {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke hente mapper');
    return;
  }

  try {
    const response = await fetch(
      `/functions/chat?action=getFolders&email=${encodeURIComponent(currentUserEmail)}`
    );

    console.log('Hent mapper respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let folders;
    try {
      folders = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig serverrespons');
    }

    if (!response.ok) {
      throw new Error(`Serverfejl: ${response.status}`);
    }

    console.log('Hentede mapper:', folders);

    const foldersDiv = document.querySelector('#folders');
    if (foldersDiv) {
      foldersDiv.innerHTML = '<h3 class="text-xl font-bold mb-2">Mapper</h3>';
      folders.forEach(folder => {
        const folderButton = document.createElement('div');
        folderButton.innerHTML = `<button class="folder-button bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mb-2 w-full text-left" data-folder="${folder}">${folder}</button>`;
        foldersDiv.appendChild(folderButton);
      });

      document.querySelectorAll('.folder-button').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const folderName = e.target.dataset.folder;
          showFolderMessages(folderName);
        });
      });
    } else {
      console.error('Mappecontainer (#folders) blev ikke fundet');
      alert('Fejl: Mappecontainer ikke fundet');
    }

    return folders; // Returner mapper til brug i dropdowns
  } catch (error) {
    console.error('Fejl ved hentning af mapper:', error);
    alert('Kunde ikke hente mapper: ' + error.message);
    return [];
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

    console.log('Hent beskeder respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let messages;
    try {
      messages = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig serverrespons');
    }

    if (!response.ok) {
      throw new Error(`Serverfejl: ${response.status}`);
    }

    console.log('Hentede beskeder:', messages);

    const folders = await getFolders(); // Hent mapper til dropdown
    const messagesDiv = document.querySelector('#messages');
    if (messagesDiv) {
      messagesDiv.innerHTML = '<h3 class="text-xl font-bold mb-2">Beskeder</h3>';
      messages.forEach(msg => {
        const li = document.createElement('div');
        li.classList.add('mb-4'); // Mellemrum mellem beskeder
        const danishTime = new Date(msg.timestamp).toLocaleString('da-DK');
        li.innerHTML = `
          <div>Fra: ${msg.sender}</div>
          <div>Sendt: ${danishTime}</div>
          <div>Indhold: ${msg.content}</div>
          <button class="decryptButton bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2" data-message-id="${msg._id}" data-content="${msg.content}">Dekrypter</button>
          <button class="deleteButton bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 mr-2" data-message-id="${msg._id}">Slet</button>
          <select class="moveFolderSelect border border-gray-300 rounded-md p-2 mr-2" data-message-id="${msg._id}">
            <option value="">Vælg mappe</option>
            ${folders.map(folder => `<option value="${folder}">${folder}</option>`).join('')}
          </select>
          <button class="moveButton bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600" data-message-id="${msg._id}">Flyt</button>
        `;
        messagesDiv.appendChild(li);
      });

      // Tilføj event listeners til slet- og flyt-knapper
      document.querySelectorAll('.deleteButton').forEach(button => {
        button.addEventListener('click', () => {
          const messageId = button.dataset.messageId;
          deleteMessage(messageId, 'main');
        });
      });

      document.querySelectorAll('.moveButton').forEach(button => {
        button.addEventListener('click', () => {
          const messageId = button.dataset.messageId;
          const select = document.querySelector(`select[data-message-id="${messageId}"]`);
          const folderName = select.value;
          if (!folderName) {
            alert('Vælg en mappe at flytte til');
            return;
          }
          moveMessage(messageId, folderName, 'main');
        });
      });
    } else {
      console.error('Beskedcontainer (#messages) blev ikke fundet');
      alert('Fejl: Beskedcontainer ikke fundet');
    }
  } catch (error) {
    console.error('Fejl ved hentning af beskeder:', error);
    alert('Kunde ikke hente beskeder: ' + error.message);
  }
}

async function showFolderMessages(folderName) {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke hente mappebeskeder');
    return;
  }

  document.querySelector('#app-section').style.display = 'none';
  document.querySelector('#folder-messages-section').style.display = 'block';

  try {
    const response = await fetch(
      `/functions/chat?action=getFolderMessages&email=${encodeURIComponent(currentUserEmail)}&folderName=${encodeURIComponent(folderName)}`
    );

    console.log('Hent mappebeskeder respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let messages;
    try {
      messages = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig serverrespons');
    }

    if (!response.ok) {
      throw new Error(`Serverfejl: ${response.status}`);
    }

    console.log(`Hentede beskeder for mappe ${folderName}:`, messages);

    const folders = await getFolders(); // Hent mapper til dropdown
    const folderMessagesDiv = document.querySelector('#folder-messages');
    if (folderMessagesDiv) {
      folderMessagesDiv.innerHTML = `<h3 class="text-xl font-bold mb-2">${folderName} Beskeder</h3>`;
      messages.forEach(msg => {
        const li = document.createElement('div');
        li.classList.add('mb-4'); // Mellemrum mellem beskeder
        const danishTime = new Date(msg.timestamp).toLocaleString('da-DK');
        li.innerHTML = `
          <div>Fra: ${msg.sender}</div>
          <div>Sendt: ${danishTime}</div>
          <div>Indhold: ${msg.content}</div>
          <button class="decryptButton bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2" data-message-id="${msg._id}" data-content="${msg.content}">Dekrypter</button>
          <button class="deleteButton bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 mr-2" data-message-id="${msg._id}">Slet</button>
          <select class="moveFolderSelect border border-gray-300 rounded-md p-2 mr-2" data-message-id="${msg._id}">
            <option value="">Vælg mappe</option>
            ${folders.map(folder => `<option value="${folder}">${folder}</option>`).join('')}
          </select>
          <button class="moveButton bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600" data-message-id="${msg._id}">Flyt</button>
        `;
        folderMessagesDiv.appendChild(li);
      });

      // Tilføj event listeners til slet- og flyt-knapper
      document.querySelectorAll('.deleteButton').forEach(button => {
        button.addEventListener('click', () => {
          const messageId = button.dataset.messageId;
          deleteMessage(messageId, folderName);
        });
      });

      document.querySelectorAll('.moveButton').forEach(button => {
        button.addEventListener('click', () => {
          const messageId = button.dataset.messageId;
          const select = document.querySelector(`select[data-message-id="${messageId}"]`);
          const newFolderName = select.value;
          if (!newFolderName) {
            alert('Vælg en mappe at flytte til');
            return;
          }
          moveMessage(messageId, newFolderName, folderName);
        });
      });
    } else {
      console.error('Mappebeskedcontainer (#folder-messages) blev ikke fundet');
      alert('Fejl: Mappebeskedcontainer ikke fundet');
    }
  } catch (error) {
    console.error(`Fejl ved hentning af ${folderName} beskeder:`, error);
    alert(`Kunde ikke hente beskeder for ${folderName}: ` + error.message);
  }
}

async function deleteMessage(messageId, context) {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke slette besked');
    alert('Log ind for at slette beskeder');
    return;
  }

  try {
    const response = await fetch('/functions/chat', {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteMessage',
        email: currentUserEmail,
        messageId
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Slet besked respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig serverrespons');
    }

    if (!response.ok) {
      throw new Error(result.error || `Serverfejl: ${response.status}`);
    }

    console.log('Besked slettet:', messageId);
    if (context === 'main') {
      getMessages();
    } else {
      showFolderMessages(context);
    }
  } catch (error) {
    console.error('Fejl ved sletning af besked:', error);
    alert('Kunne ikke slette besked: ' + error.message);
  }
}

async function moveMessage(messageId, folderName, context) {
  if (!currentUserEmail) {
    console.warn('Ingen bruger logget ind, kan ikke flytte besked');
    alert('Log ind for at flytte beskeder');
    return;
  }

  try {
    const response = await fetch('/functions/chat', {
      method: 'POST',
      body: JSON.stringify({
        action: 'moveMessage',
        email: currentUserEmail,
        messageId,
        folderName
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Flyt besked respons status:', response.status, response.statusText);
    const rawResponse = await response.text();
    console.log('Rå respons:', rawResponse);

    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('JSON parsing fejl:', jsonError, 'Rå respons:', rawResponse);
      throw new Error('Ugyldig serverrespons');
    }

    if (!response.ok) {
      throw new Error(result.error || `Serverfejl: ${response.status}`);
    }

    console.log('Besked flyttet til:', folderName);
    if (context === 'main') {
      getMessages();
    } else {
      showFolderMessages(context);
    }
  } catch (error) {
    console.error('Fejl ved flytning af besked:', error);
    alert('Kunde ikke flytte besked: ' + error.message);
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