export class QuizOptionResponseDto {
  id: string;
  label: string;
  isCorrect: boolean;
}

export class QuizQuestionResponseDto {
  id: string;
  question: string;
  feedback: string;
  options: QuizOptionResponseDto[];
}
