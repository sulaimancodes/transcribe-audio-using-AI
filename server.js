const express = require('express');
const upload = require('express-fileupload');

const app = express();
const API_TOKEN = "cff3c0bc041c439badb1906eabe2a2d9";
app.use(upload());



// Function to upload file data to the AssemblyAI API
async function upload_file(api_token, data) {
    console.log("Uploading file...");

    const url = "https://api.assemblyai.com/v2/upload";

    try {
        // Send a POST request to the API to upload the file data, passing in the headers and the data
        const response = await fetch(url, {
            method: "POST",
            body: data,
            headers: {
                "Content-Type": "application/octet-stream",
                Authorization: api_token,
            },
        });

        // If the response is successful, return the upload URL
        if (response.status === 200) {
            const responseData = await response.json();
            return responseData["upload_url"];
        } else {
            console.error(`Error: ${response.status} - ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.error(`Error: ${error}`);
        return null;
    }
}




async function transcribeAudio(api_token, audio_url) {
    console.log("Transcribing audio... This might take a moment.");

    // Set the headers for the request, including the API token and content type
    const headers = {
        authorization: api_token,
        "content-type": "application/json",
    };

    // Send a POST request to the transcription API with the audio URL in the request body
    const response = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        body: JSON.stringify({ audio_url }),
        headers,
    });

    // Retrieve the ID of the transcript from the response data
    const responseData = await response.json();
    const transcriptId = responseData.id;

    // Construct the polling endpoint URL using the transcript ID
    const pollingEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

    // Poll the transcription API until the transcript is ready
    while (true) {
        // Send a GET request to the polling endpoint to retrieve the status of the transcript
        const pollingResponse = await fetch(pollingEndpoint, { headers });
        const transcriptionResult = await pollingResponse.json();

        // If the transcription is complete, return the transcript object
        if (transcriptionResult.status === "completed") {
            return transcriptionResult;
        }
        // If the transcription has failed, throw an error with the error message
        else if (transcriptionResult.status === "error") {
            throw new Error(`Transcription failed: ${transcriptionResult.error}`);
        }
        // If the transcription is still in progress, wait for a few seconds before polling again
        else {
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}




app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
}
);


app.get('/response', (req, res) => {
    res.sendFile(__dirname + '/response.html');
});




app.post('/', async (req, res) => {
    if (req.files) {
        var data = req.files.file.data; // Access the 'data' property of the 'data' property
        console.log(data);

        try {
            // Call the upload_file function with the buffer data to get the upload URL
            const uploadUrl = await upload_file(API_TOKEN, data);

            // If the upload fails, send an error response
            if (!uploadUrl) {
                return res.status(500).json({ error: "Upload failed. Please try again." });
            }

            // Call the transcribeAudio function with the upload URL to get the transcript
            const transcript = await transcribeAudio(API_TOKEN, uploadUrl);

            // If the transcription fails, send an error response
            if (!transcript) {
                return res.status(500).json({ error: "Transcription failed. Please try again." });
            }

            // Send the transcript as the response
            //return res.json({ transcript });
            return res.redirect(`/response?transcript=${encodeURIComponent(JSON.stringify(transcript.text))}`);



        } catch (error) {
            // Handle any errors that occur during the process
            console.error("Error:", error);
            return res.status(500).json({ error: "An error occurred. Please try again." });
        }
    } else {
        // If no file is provided, send an error response
        return res.status(400).json({ error: "No file uploaded." });
    }
});



app.listen(3000, () => {
    console.log('Server is running at port 3000');
}
);
