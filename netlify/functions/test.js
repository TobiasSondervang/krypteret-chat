```javascript
     exports.handler = async (event, context) => {
         console.log('Test function invoked:', { method: event.httpMethod, body: event.body });
         return {
             statusCode: 200,
             body: JSON.stringify({ success: true, message: 'Test function works!' })
         };
     };
     ```
