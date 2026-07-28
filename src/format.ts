import { format as oxfmtFormat } from "oxfmt";

export async function format(input: string) {
  try {
    const { code } = await oxfmtFormat("prismatype.ts", input);
    return code;
  } catch (error) {
    console.error("Error formatting file", error);
    return input;
  }
}
