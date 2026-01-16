/**
 * eval: Evaluate, refine, learn
 *
 * - grader.ts: Score copy against brand rubric
 * - image-grader.ts: Score images against brand style
 * - learnings.ts: Aggregate feedback, inject into generation
 */

// Copy grading
export { grade, gradeAndRefine, loadRubric } from './grader'
export type { EvalResult, Rubric, GradeOptions, RefineResult } from './grader'

// Image grading
export { gradeImage } from './image-grader'
export type { ImageEvalResult, ImageGradeOptions } from './image-grader'

// Learnings (feedback loop)
export {
  loadLearnings,
  saveLearnings,
  aggregateLearnings,
  getCopyContext,
  getImageContext
} from './learnings'
export type { Learnings } from './learnings'
