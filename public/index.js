document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.querySelector('.send-button');
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
      console.log('Send-knap fundet og event listener tilføjet');
    } else {
      console.error('Send-knap (.send-button) blev ikke fundet i DOM');
    }
    getFolderMessages('Sent');
    getFolderMessages('Received');
  });

  async function sendMessage() {
    const sendButton = document.querySelector('.send-button');
    if (!sendButton) {
      console.error('Send-knap (.send-button) mangler under afsendelse');
      return;
    }
    sendButton.disabled = true;

    const sender = document.querySelector('.sender-email').value;
    const recipient = document.querySelector('.recipient-email').value;
    const content = document.querySelector('.message-content').value;

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        body: JSON.stringify({ sender, recipient, content }),
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Fejl ved afsendelse');
      }

      console.log('Besked sendt succesfuldt:', result);
      document.querySelector('.message-content').value = '';
      await getFolderMessages('Sent');
    } catch (error) {
      console.error('Fejl ved afsendelse:', error);
      alert('Kunne ikke sende besked: ' + error.message);
    } finally {
      sendButton.disabled = false;
    }
  }

  async function getFolderMessages(folderName) {
    const email = document.querySelector('.sender-email').value;
    try {
      const response = await fetch(
        `/.netlify/functions/chat?action=getFolderMessages&email=${encodeURIComponent(email)}&folderName=${folderName}`
      );
      const messages = await response.json();

      console.log(`Hentede beskeder for ${folderName}:`, messages);

      const messageList = document.querySelector(`.${folderName.toLowerCase()}-messages`);
      if (messageList) {
        messageList.innerHTML = '';
        messages.forEach(msg => {
          const li = document.createElement('li');
          li.innerHTML = `
            ${msg.content}
            <button class="decryptButton" data-message-id="${msg._id}">Dekrypt</button>
          `;
          messageList.appendChild(li);
        });
      } else {
        console.error(`Beskedliste (.${folderName.toLowerCase()}-messages) blev ikke fundet`);
      }
    } catch (error) {
      console.error(`Fejl ved hentning af ${folderName} beskeder:`, error);
    }
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
      const encryptedContent = event.target.parentElement.textContent.trim().split(' ')[0];
      decryptMessage(messageId, encryptedContent);
    }
  });
