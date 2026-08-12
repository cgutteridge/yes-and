import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import { runCommand } from "./cli/runCommand.js";
import { runAudiencePromptCommand } from "./cli/audiencePromptCommand.js";
import { formatAudiencePromptTypeIds } from "./improv/audiencePromptTypes.js";
import { runQueryCommand, type QueryCommandOptions } from "./cli/queryCommand.js";
import { runSceneCommand, type SceneCommandOptions } from "./cli/sceneCommand.js";
import { exampleSchemas } from "./schemas/exampleSchemas.js";

loadDotenv({ quiet: true });

const program = new Command();

program
  .name("yesand")
  .description("CLI being repurposed into a turn-based AI improv practice-partner system.");

program
  .command("query")
  .description("Query an OpenAI-compatible AI API and validate the JSON response against a schema")
  .argument("<prompt>", "prompt to send to the model")
  .option(
    "-s, --schema <name>",
    `example schema to validate against (${Object.keys(exampleSchemas).join(", ")})`,
    "summary",
  )
  .option(
    "--max-attempts <count>",
    "retry attempts on schema validation failure",
    (value: string) => Number.parseInt(value, 10),
    2,
  )
  .action(async (prompt: string, options: QueryCommandOptions) => {
    await runCommand(() => runQueryCommand(prompt, options));
  });

program
  .command("scene")
  .description("Run a turn-based improv scene from a scene-config file")
  .requiredOption("-c, --config <path>", "path to a scene-config JSON file")
  .action(async (options: SceneCommandOptions) => {
    await runCommand(() => runSceneCommand(options));
  });

program
  .command("audience-prompt")
  .description("Generate a simulated audience shout for a requested prompt type")
  .argument("<type>", `prompt type id (${formatAudiencePromptTypeIds()})`)
  .action(async (promptType: string) => {
    await runCommand(() => runAudiencePromptCommand(promptType));
  });

await program.parseAsync(process.argv);
