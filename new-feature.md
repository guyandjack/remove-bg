Act as a Senior Fullstack Architect and Node.js/React developer. 

Context:
We are building a multi-tenant AI video generation feature (Motion Design) integrated into an image processing SaaS. The video rendering engine is based on the "HyperFrames" framework. To optimize costs and privacy, we use zero-cost local rendering on a VPS and a hybrid AI architecture.

Here is the exact technical workflow and data flow between the entities:

1. Frontend (React):
   - The user inputs a text prompt describing the desired video.
   - The user selects a visual style via a grid of 10-second looping video thumbnails.
   - The user selects a video duration and submits the form.
   - It displays a loading state/progress bar while the backend orchestrates the creation.
   - Once completed, it receives the final video URL to let the user play and download it.

2. API Gateway & Backend Orchestrator (Node.js):
   - Receives the payload (prompt, style, duration) from the React Frontend.
   - Analyzes the client's prompt to dynamically pick the required HyperFrames markdown configuration files from the local storage (e.g., 'skills/hyperframes.md' + specific 'skills/media-use/xxx.md' files based on intent like audio, voiceover, etc.).
   - Merges these skills into a robust System Prompt.
   - Handles API rate-limiting protections (HTTP 429 retries with exponential backoff) and manages a job queue (like BullMQ) to avoid server crashes.

3. Code Generation AI (Groq API Cloud):
   - The Backend calls the Groq API using the 'qwen-2.5-coder-32b' model (Developer Plan).
   - Input: The engineered System Prompt (HyperFrames Skills Pack) + User Prompt + Style Constraints.
   - Groq leverages Prompt Caching on the stable system prompt to reduce token costs.
   - Output: Groq returns raw, valid HyperFrames HTML/CSS/GSAP code wrapped in a clean markdown code block, with zero conversational filler.

4. Video Rendering & Encoding Engine (VPS Infomaniak - Ubuntu 26.04 LTS):
   - The Node.js backend extracts the HTML code returned by Groq and saves it as an 'index.html' file locally.
   - The backend spawns a child process to execute the local rendering command: `npx hyperframes render`.
   - Under the hood, this launches Headless Chrome to capture the GSAP animations frame-by-frame, then pipes them into FFmpeg to encode the images into a high-quality H.264 MP4 video file.
   - The generated video is saved to a public storage directory (or Cloudflare R2/S3) and the API returns the file URL back to the React Frontend.

Goal:
Keep this architecture in mind for all subsequent code generation requests. I will ask you to build specific parts of this workflow (React UI components, Node.js controllers, Groq API callers, or FFmpeg queue workers). 

Please acknowledge that you understand the role of each entity and the complete data flow before we write the first line of code.