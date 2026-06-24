import { fetchTaskById } from "@/lib/sanity/tasks";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
const RequestSchema = z.object({
  userId: z.string(),
  taskId: z.string(),
});
const SubtaskSchema = z.object({
  subtasks: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "A short, concrete, actionable step. Written for someone with ADHD — specific and small enough to do in one sitting.",
        ),
    }),
  ),
});
export async function POST(request: Request) {
  const { userId, taskId } = await request.json();
  const validationResult = RequestSchema.safeParse({ userId, taskId });
  //use the validation result to check if the input is valid
  if (!validationResult.success) {
    return new Response(JSON.stringify({ error: validationResult.error }), {
      status: 400,
    });
  }
  try {
    const task = await fetchTaskById(taskId);
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log("Creating subtask for task:", task.title);
    //prepare entry text for AI analysis
    const entryText = `Task: ${task.title}`;
    // use ai to generate subtasks based on the task title
    const result = await generateText({
      model: google("gemini-2.5-flash"),
      output: Output.object({
        schema: SubtaskSchema,
      }),
      prompt: `You are the best ADHD productivity coach, helping people break down their tasks into small, actionable steps. Given a task, you will create a list of subtasks that are specific, concrete, and small enough to be completed in one sitting. The subtasks should be designed to help someone with ADHD make progress on their task without feeling overwhelmed.
Task to break down:
${entryText}

Rules
1. The number of subtasks should be between 3-6 to be carefully decided based on time-blindness and Wall of Awful theories.
2. First subtask of every task should be tiny and frictionless requiring almost no motivation to start.
3. Each subtask is concrete, physical and actionable steps, starting with a verb and avoiding phrases like plan, prepare, organize. include setup → action → cleanup steps.
4. Sequential and ordered.
5. Bias toward step being too small rather than too big.

Example
Task: Wash dishes
Subtasks: 
Walk over to sink
Clean space near sink
Stack dirty dishes in one pile
Put on gloves and get sponge ready
Scrape food off dishes into trash
Wash plates first
Wash glass second
Wash cutlery last
Rinse the sink and wipe counter,`,
    });
    const subtasks = result.output.subtasks.map((subtask) => ({
      title: subtask.title,
      completed: false,
      _key: crypto.randomUUID(),
    }));
    return Response.json({
      subtasks: subtasks,
    });
  } catch (error) {
    console.error("Error generating subtasks:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate subtasks" }),
      {
        status: 500,
      },
    );
  }
}
