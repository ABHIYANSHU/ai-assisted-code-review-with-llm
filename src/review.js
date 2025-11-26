import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { Octokit } from "octokit";
import { createPrompt } from "../utils/prompt.js";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const context = {
  owner: process.env.REPO_OWNER,
  repo: process.env.REPO_NAME,
  pull_number: parseInt(process.env.PR_NUMBER),
};

async function main() {
    // Find difference between source and destination
    const { data: prDiff } = await octokit.rest.pulls.get({
        ...context,
        mediaType: { format: "diff" },
    });
    
    if (!prDiff) {
        console.log("No diff found.");
        return;
    }

    const prompt = createPrompt(prDiff);

    const command = new InvokeModelCommand({
        modelId: process.env.AWS_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
        }),
    });

    const response = await bedrock.send(command);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiResultText = responseBody.content[0].text;

    let reviewDecision;

    try {
        // CLEANUP: Remove Markdown code blocks if the AI added them (e.g. ```json ... ```)
        const cleanText = aiResultText.replace(/```json\s*|\s*```/g, "");

        // FIND JSON: Look for the first '{' and last '}' to isolate the object
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    
        if (!jsonMatch) {
            console.error("Raw AI Output:", aiResultText);
            throw new Error("Could not find JSON in AI response");
        }

        // PARSE: Convert string to Object
        reviewDecision = JSON.parse(jsonMatch[0]);
    
        console.log(`✅ Parsed Decision: ${reviewDecision.status}`);

    } catch (error) {
        console.error("❌ JSON Parse Error:", error.message);
        console.error("Raw AI Output:", aiResultText);
        process.exit(1); // Fail the Action so you see the Red X
    }

    const finalBody = `### ${reviewDecision.verdict}\n\n${reviewDecision.comments}`;

    await octokit.rest.pulls.createReview({
        ...context,
        body: finalBody,
        event: "COMMENT", // <--- CHANGE THIS (Approve the PR)
    });

    console.log(`🎉 Review Commented: ${reviewDecision.verdict}`);
}