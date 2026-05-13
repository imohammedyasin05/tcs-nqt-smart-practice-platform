/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Subject = 'Quant' | 'Logical' | 'Verbal' | 'Coding';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Question {
  id: string;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  questionText: string;
}

export interface AptitudeQuestion extends Question {
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface CodingQuestion extends Question {
  problemStatement: string;
  sampleInput: string;
  sampleOutput: string;
  constraints: string;
  explanation: string;
}

export interface ExamSession {
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  examMode: boolean;
  timerEnabled: boolean;
  calculatorEnabled: boolean;
  timeRemaining: number; // in seconds
  questions: (AptitudeQuestion | CodingQuestion)[];
  answers: Record<string, string>;
  status: 'IDLE' | 'STARTED' | 'COMPLETED';
  provider: 'auto' | 'gemini' | 'groq';
}
