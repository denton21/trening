window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    formatTime,
    setPressed,
    animateExample,
    bumpStat,
    flashAnswer,
    flashTask,
    setProgress,
    showMessage,
    getSettings,
    saveSettings,
    pushSessionAttempt,
    showSessionSummary
  } = Trainer;

  // Примеры из scale_2400 / (1) / (2) — только сложение, без минусов.
  // Дедуп по (a,b); ответы проверены a+b.
  const ADDITION_BANK = [
    { a: 93, b: 5, answer: 98 },
    { a: 39, b: 3, answer: 42 },
    { a: 78, b: 7, answer: 85 },
    { a: 73, b: 4, answer: 77 },
    { a: 70, b: 4, answer: 74 },
    { a: 23, b: 4, answer: 27 },
    { a: 24, b: 8, answer: 32 },
    { a: 50, b: 6, answer: 56 },
    { a: 30, b: 4, answer: 34 },
    { a: 23, b: 8, answer: 31 },
    { a: 14, b: 3, answer: 17 },
    { a: 15, b: 8, answer: 23 },
    { a: 44, b: 3, answer: 47 },
    { a: 82, b: 9, answer: 91 },
    { a: 74, b: 8, answer: 82 },
    { a: 63, b: 7, answer: 70 },
    { a: 98, b: 6, answer: 104 },
    { a: 72, b: 8, answer: 80 },
    { a: 27, b: 2, answer: 29 },
    { a: 70, b: 3, answer: 73 },
    { a: 36, b: 6, answer: 42 },
    { a: 60, b: 3, answer: 63 },
    { a: 28, b: 6, answer: 34 },
    { a: 13, b: 3, answer: 16 },
    { a: 15, b: 3, answer: 18 },
    { a: 80, b: 9, answer: 89 },
    { a: 68, b: 7, answer: 75 },
    { a: 48, b: 7, answer: 55 },
    { a: 51, b: 9, answer: 60 },
    { a: 68, b: 9, answer: 77 },
    { a: 86, b: 3, answer: 89 },
    { a: 23, b: 7, answer: 30 },
    { a: 92, b: 2, answer: 94 },
    { a: 16, b: 6, answer: 22 },
    { a: 15, b: 9, answer: 24 },
    { a: 81, b: 3, answer: 84 },
    { a: 43, b: 5, answer: 48 },
    { a: 49, b: 9, answer: 58 },
    { a: 58, b: 5, answer: 63 },
    { a: 90, b: 8, answer: 98 },
    { a: 23, b: 2, answer: 25 },
    { a: 29, b: 5, answer: 34 },
    { a: 93, b: 2, answer: 95 },
    { a: 91, b: 9, answer: 100 },
    { a: 15, b: 4, answer: 19 },
    { a: 38, b: 9, answer: 47 },
    { a: 63, b: 9, answer: 72 },
    { a: 94, b: 9, answer: 103 },
    { a: 76, b: 6, answer: 82 },
    { a: 25, b: 5, answer: 30 },
    { a: 80, b: 4, answer: 84 },
    { a: 97, b: 3, answer: 100 },
    { a: 23, b: 3, answer: 26 },
    { a: 78, b: 2, answer: 80 },
    { a: 78, b: 3, answer: 81 },
    { a: 30, b: 2, answer: 32 },
    { a: 36, b: 8, answer: 44 },
    { a: 81, b: 4, answer: 85 },
    { a: 96, b: 9, answer: 105 },
    { a: 68, b: 3, answer: 71 },
    { a: 30, b: 5, answer: 35 },
    { a: 65, b: 2, answer: 67 },
    { a: 69, b: 8, answer: 77 },
    { a: 72, b: 6, answer: 78 },
    { a: 36, b: 7, answer: 43 },
    { a: 58, b: 7, answer: 65 },
    { a: 16, b: 3, answer: 19 },
    { a: 25, b: 2, answer: 27 },
    { a: 98, b: 3, answer: 101 },
    { a: 73, b: 7, answer: 80 },
    { a: 35, b: 6, answer: 41 },
    { a: 48, b: 5, answer: 53 },
    { a: 52, b: 4, answer: 56 },
    { a: 78, b: 6, answer: 84 },
    { a: 83, b: 3, answer: 86 },
    { a: 35, b: 7, answer: 42 },
    { a: 25, b: 8, answer: 33 },
    { a: 87, b: 2, answer: 89 },
    { a: 22, b: 9, answer: 31 },
    { a: 82, b: 7, answer: 89 },
    { a: 46, b: 2, answer: 48 },
    { a: 86, b: 2, answer: 88 },
    { a: 94, b: 8, answer: 102 },
    { a: 45, b: 8, answer: 53 },
    { a: 57, b: 3, answer: 60 },
    { a: 25, b: 3, answer: 28 },
    { a: 35, b: 8, answer: 43 },
    { a: 74, b: 5, answer: 79 },
    { a: 76, b: 9, answer: 85 },
    { a: 35, b: 5, answer: 40 },
    { a: 12, b: 9, answer: 21 },
    { a: 47, b: 5, answer: 52 },
    { a: 80, b: 7, answer: 87 },
    { a: 16, b: 2, answer: 18 },
    { a: 59, b: 2, answer: 61 },
    { a: 63, b: 8, answer: 71 },
    { a: 12, b: 3, answer: 15 },
    { a: 63, b: 6, answer: 69 },
    { a: 28, b: 2, answer: 30 },
    { a: 74, b: 9, answer: 83 },
    { a: 66, b: 7, answer: 73 },
    { a: 54, b: 3, answer: 57 },
    { a: 58, b: 8, answer: 66 },
    { a: 45, b: 7, answer: 52 },
    { a: 21, b: 7, answer: 28 },
    { a: 54, b: 6, answer: 60 },
    { a: 39, b: 5, answer: 44 },
    { a: 24, b: 9, answer: 33 },
    { a: 63, b: 4, answer: 67 },
    { a: 15, b: 7, answer: 22 },
    { a: 35, b: 2, answer: 37 },
    { a: 97, b: 8, answer: 105 },
    { a: 34, b: 9, answer: 43 },
    { a: 54, b: 4, answer: 58 },
    { a: 83, b: 2, answer: 85 },
    { a: 91, b: 2, answer: 93 },
    { a: 81, b: 9, answer: 90 },
    { a: 21, b: 9, answer: 30 },
    { a: 53, b: 3, answer: 56 },
    { a: 50, b: 7, answer: 57 },
    { a: 84, b: 2, answer: 86 },
    { a: 76, b: 2, answer: 78 },
    { a: 64, b: 60, answer: 124 },
    { a: 46, b: 42, answer: 88 },
    { a: 88, b: 14, answer: 102 },
    { a: 44, b: 54, answer: 98 },
    { a: 89, b: 54, answer: 143 },
    { a: 83, b: 17, answer: 100 },
    { a: 89, b: 15, answer: 104 },
    { a: 13, b: 30, answer: 43 },
    { a: 70, b: 19, answer: 89 },
    { a: 45, b: 18, answer: 63 },
    { a: 90, b: 51, answer: 141 },
    { a: 24, b: 81, answer: 105 },
    { a: 44, b: 74, answer: 118 },
    { a: 54, b: 70, answer: 124 },
    { a: 32, b: 39, answer: 71 },
    { a: 43, b: 87, answer: 130 },
    { a: 35, b: 61, answer: 96 },
    { a: 24, b: 17, answer: 41 },
    { a: 58, b: 88, answer: 146 },
    { a: 63, b: 26, answer: 89 },
    { a: 43, b: 58, answer: 101 },
    { a: 56, b: 21, answer: 77 },
    { a: 54, b: 51, answer: 105 },
    { a: 98, b: 87, answer: 185 },
    { a: 29, b: 50, answer: 79 },
    { a: 96, b: 96, answer: 192 },
    { a: 64, b: 31, answer: 95 },
    { a: 83, b: 29, answer: 112 },
    { a: 95, b: 66, answer: 161 },
    { a: 19, b: 47, answer: 66 },
    { a: 33, b: 71, answer: 104 },
    { a: 70, b: 56, answer: 126 },
    { a: 18, b: 90, answer: 108 },
    { a: 97, b: 57, answer: 154 },
    { a: 21, b: 93, answer: 114 },
    { a: 64, b: 80, answer: 144 },
    { a: 64, b: 50, answer: 114 },
    { a: 29, b: 37, answer: 66 },
    { a: 66, b: 30, answer: 96 },
    { a: 96, b: 42, answer: 138 },
    { a: 55, b: 25, answer: 80 },
    { a: 41, b: 62, answer: 103 },
    { a: 40, b: 19, answer: 59 },
    { a: 52, b: 28, answer: 80 },
    { a: 62, b: 98, answer: 160 },
    { a: 92, b: 89, answer: 181 },
    { a: 36, b: 70, answer: 106 },
    { a: 32, b: 20, answer: 52 },
    { a: 47, b: 48, answer: 95 },
    { a: 35, b: 29, answer: 64 },
    { a: 19, b: 34, answer: 53 },
    { a: 99, b: 80, answer: 179 },
    { a: 76, b: 51, answer: 127 },
    { a: 94, b: 28, answer: 122 },
    { a: 81, b: 16, answer: 97 },
    { a: 69, b: 51, answer: 120 },
    { a: 61, b: 83, answer: 144 },
    { a: 43, b: 62, answer: 105 },
    { a: 64, b: 75, answer: 139 },
    { a: 13, b: 84, answer: 97 },
    { a: 62, b: 15, answer: 77 },
    { a: 56, b: 72, answer: 128 },
    { a: 17, b: 81, answer: 98 },
    { a: 22, b: 63, answer: 85 },
    { a: 42, b: 18, answer: 60 },
    { a: 99, b: 52, answer: 151 },
    { a: 17, b: 97, answer: 114 },
    { a: 50, b: 57, answer: 107 },
    { a: 62, b: 26, answer: 88 },
    { a: 57, b: 54, answer: 111 },
    { a: 28, b: 45, answer: 73 },
    { a: 21, b: 60, answer: 81 },
    { a: 59, b: 16, answer: 75 },
    { a: 43, b: 28, answer: 71 },
    { a: 28, b: 58, answer: 86 },
    { a: 18, b: 86, answer: 104 },
    { a: 77, b: 65, answer: 142 },
    { a: 71, b: 46, answer: 117 },
    { a: 98, b: 29, answer: 127 },
    { a: 96, b: 27, answer: 123 },
    { a: 17, b: 19, answer: 36 },
    { a: 38, b: 54, answer: 92 },
    { a: 88, b: 50, answer: 138 },
    { a: 93, b: 51, answer: 144 },
    { a: 19, b: 26, answer: 45 },
    { a: 45, b: 86, answer: 131 },
    { a: 44, b: 44, answer: 88 },
    { a: 16, b: 98, answer: 114 },
    { a: 32, b: 16, answer: 48 },
    { a: 34, b: 71, answer: 105 },
    { a: 88, b: 54, answer: 142 },
    { a: 62, b: 65, answer: 127 },
    { a: 68, b: 46, answer: 114 },
    { a: 70, b: 26, answer: 96 },
    { a: 23, b: 17, answer: 40 },
    { a: 22, b: 62, answer: 84 },
    { a: 63, b: 72, answer: 135 },
    { a: 35, b: 66, answer: 101 },
    { a: 86, b: 64, answer: 150 },
    { a: 57, b: 79, answer: 136 },
    { a: 32, b: 33, answer: 65 },
    { a: 53, b: 99, answer: 152 },
    { a: 24, b: 58, answer: 82 },
    { a: 40, b: 92, answer: 132 },
    { a: 99, b: 14, answer: 113 },
    { a: 47, b: 80, answer: 127 },
    { a: 14, b: 99, answer: 113 },
    { a: 29, b: 24, answer: 53 },
    { a: 83, b: 61, answer: 144 },
    { a: 48, b: 22, answer: 70 },
    { a: 92, b: 21, answer: 113 },
    { a: 37, b: 80, answer: 117 },
    { a: 90, b: 65, answer: 155 },
    { a: 23, b: 81, answer: 104 },
    { a: 90, b: 57, answer: 147 },
    { a: 80, b: 85, answer: 165 },
    { a: 72, b: 74, answer: 146 },
    { a: 78, b: 40, answer: 118 },
    { a: 50, b: 76, answer: 126 },
    { a: 33, b: 88, answer: 121 },
    { a: 74, b: 63, answer: 137 },
    { a: 44, b: 65, answer: 109 },
    { a: 95, b: 80, answer: 175 },
    { a: 98, b: 54, answer: 152 },
    { a: 80, b: 42, answer: 122 },
    { a: 81, b: 55, answer: 136 },
    { a: 77, b: 73, answer: 150 },
    { a: 13, b: 58, answer: 71 },
    { a: 55, b: 93, answer: 148 },
    { a: 78, b: 67, answer: 145 },
    { a: 21, b: 67, answer: 88 },
    { a: 87, b: 29, answer: 116 },
    { a: 73, b: 61, answer: 134 },
    { a: 13, b: 18, answer: 31 },
    { a: 55, b: 89, answer: 144 },
    { a: 83, b: 56, answer: 139 },
    { a: 16, b: 14, answer: 30 },
    { a: 24, b: 26, answer: 50 },
    { a: 53, b: 62, answer: 115 },
    { a: 15, b: 74, answer: 89 },
    { a: 26, b: 79, answer: 105 },
    { a: 35, b: 89, answer: 124 },
    { a: 54, b: 31, answer: 85 },
    { a: 73, b: 54, answer: 127 },
    { a: 93, b: 68, answer: 161 },
    { a: 88, b: 67, answer: 155 },
    { a: 54, b: 54, answer: 108 },
    { a: 75, b: 68, answer: 143 },
    { a: 53, b: 42, answer: 95 },
    { a: 52, b: 74, answer: 126 },
    { a: 26, b: 36, answer: 62 },
    { a: 75, b: 35, answer: 110 },
    { a: 13, b: 95, answer: 108 },
    { a: 26, b: 47, answer: 73 },
    { a: 38, b: 84, answer: 122 },
    { a: 14, b: 50, answer: 64 },
    { a: 47, b: 43, answer: 90 },
    { a: 25, b: 19, answer: 44 },
    { a: 61, b: 27, answer: 88 },
    { a: 69, b: 53, answer: 122 },
    { a: 57, b: 45, answer: 102 },
    { a: 74, b: 19, answer: 93 },
    { a: 90, b: 93, answer: 183 },
    { a: 49, b: 14, answer: 63 },
    { a: 37, b: 47, answer: 84 },
    { a: 90, b: 97, answer: 187 },
    { a: 38, b: 91, answer: 129 },
    { a: 34, b: 49, answer: 83 },
    { a: 65, b: 72, answer: 137 },
    { a: 78, b: 74, answer: 152 },
    { a: 57, b: 58, answer: 115 },
    { a: 79, b: 84, answer: 163 },
    { a: 87, b: 19, answer: 106 },
    { a: 84, b: 46, answer: 130 },
    { a: 22, b: 86, answer: 108 },
    { a: 63, b: 15, answer: 78 },
    { a: 68, b: 23, answer: 91 },
    { a: 22, b: 51, answer: 73 },
    { a: 69, b: 94, answer: 163 },
    { a: 32, b: 83, answer: 115 },
    { a: 93, b: 46, answer: 139 },
    { a: 70, b: 57, answer: 127 },
    { a: 36, b: 12, answer: 48 },
    { a: 67, b: 73, answer: 140 },
    { a: 15, b: 27, answer: 42 },
    { a: 38, b: 45, answer: 83 },
    { a: 91, b: 22, answer: 113 },
    { a: 59, b: 91, answer: 150 },
    { a: 61, b: 25, answer: 86 },
    { a: 86, b: 31, answer: 117 },
    { a: 65, b: 73, answer: 138 },
    { a: 77, b: 12, answer: 89 },
    { a: 51, b: 81, answer: 132 },
    { a: 25, b: 23, answer: 48 },
    { a: 55, b: 99, answer: 154 },
    { a: 82, b: 51, answer: 133 },
    { a: 18, b: 76, answer: 94 },
    { a: 96, b: 55, answer: 151 },
    { a: 43, b: 23, answer: 66 },
    { a: 25, b: 61, answer: 86 },
    { a: 57, b: 50, answer: 107 },
    { a: 40, b: 62, answer: 102 },
    { a: 33, b: 97, answer: 130 },
    { a: 49, b: 74, answer: 123 },
    { a: 89, b: 85, answer: 174 },
    { a: 38, b: 99, answer: 137 },
    { a: 61, b: 29, answer: 90 },
    { a: 29, b: 58, answer: 87 },
    { a: 46, b: 24, answer: 70 },
    { a: 18, b: 31, answer: 49 },
    { a: 93, b: 38, answer: 131 },
    { a: 47, b: 85, answer: 132 },
    { a: 42, b: 44, answer: 86 },
    { a: 58, b: 15, answer: 73 },
    { a: 96, b: 62, answer: 158 },
    { a: 91, b: 20, answer: 111 },
    { a: 82, b: 92, answer: 174 },
    { a: 49, b: 77, answer: 126 },
    { a: 41, b: 99, answer: 140 },
    { a: 76, b: 44, answer: 120 },
    { a: 39, b: 70, answer: 109 },
    { a: 64, b: 26, answer: 90 },
    { a: 16, b: 68, answer: 84 },
    { a: 68, b: 75, answer: 143 },
    { a: 73, b: 63, answer: 136 },
    { a: 27, b: 82, answer: 109 },
    { a: 82, b: 61, answer: 143 },
    { a: 75, b: 69, answer: 144 },
    { a: 95, b: 25, answer: 120 },
    { a: 43, b: 35, answer: 78 },
    { a: 17, b: 58, answer: 75 },
    { a: 27, b: 41, answer: 68 },
    { a: 66, b: 93, answer: 159 },
    { a: 59, b: 92, answer: 151 },
    { a: 30, b: 45, answer: 75 },
    { a: 95, b: 89, answer: 184 },
    { a: 52, b: 46, answer: 98 },
    { a: 22, b: 32, answer: 54 },
    { a: 30, b: 95, answer: 125 },
    { a: 23, b: 76, answer: 99 },
    { a: 59, b: 83, answer: 142 },
    { a: 70, b: 55, answer: 125 },
    { a: 67, b: 48, answer: 115 },
    { a: 82, b: 82, answer: 164 },
    { a: 15, b: 45, answer: 60 },
    { a: 84, b: 38, answer: 122 },
    { a: 12, b: 74, answer: 86 },
    { a: 75, b: 77, answer: 152 },
    { a: 68, b: 53, answer: 121 },
    { a: 29, b: 89, answer: 118 },
    { a: 12, b: 93, answer: 105 },
    { a: 70, b: 37, answer: 107 },
    { a: 48, b: 17, answer: 65 },
    { a: 72, b: 28, answer: 100 },
    { a: 67, b: 26, answer: 93 },
    { a: 91, b: 69, answer: 160 },
    { a: 39, b: 92, answer: 131 },
    { a: 47, b: 99, answer: 146 },
    { a: 73, b: 78, answer: 151 },
    { a: 12, b: 68, answer: 80 },
    { a: 53, b: 61, answer: 114 },
    { a: 35, b: 59, answer: 94 },
    { a: 64, b: 66, answer: 130 },
    { a: 38, b: 57, answer: 95 },
    { a: 96, b: 31, answer: 127 },
    { a: 59, b: 53, answer: 112 },
    { a: 67, b: 24, answer: 91 },
    { a: 35, b: 60, answer: 95 },
    { a: 39, b: 13, answer: 52 },
    { a: 70, b: 66, answer: 136 },
    { a: 77, b: 36, answer: 113 },
    { a: 23, b: 73, answer: 96 },
    { a: 31, b: 60, answer: 91 },
    { a: 54, b: 23, answer: 77 },
    { a: 78, b: 73, answer: 151 },
    { a: 82, b: 36, answer: 118 },
    { a: 62, b: 60, answer: 122 },
    { a: 38, b: 31, answer: 69 },
    { a: 96, b: 83, answer: 179 },
    { a: 62, b: 27, answer: 89 },
    { a: 75, b: 48, answer: 123 },
    { a: 81, b: 93, answer: 174 },
    { a: 98, b: 96, answer: 194 },
    { a: 44, b: 90, answer: 134 },
    { a: 92, b: 27, answer: 119 },
    { a: 12, b: 91, answer: 103 },
    { a: 60, b: 51, answer: 111 },
    { a: 86, b: 19, answer: 105 },
    { a: 60, b: 96, answer: 156 },
    { a: 47, b: 21, answer: 68 },
    { a: 85, b: 59, answer: 144 },
    { a: 35, b: 91, answer: 126 },
    { a: 45, b: 62, answer: 107 },
    { a: 28, b: 76, answer: 104 }
];

  const state = {
    duration: 60,
    secondsLeft: 60,
    current: null,
    correct: 0,
    wrong: 0,
    running: false,
    timer: null,
    nextTimer: null,
    lastKey: null,
    questionStartedAt: null,
    sessionLog: []
  };

  const els = {
    timeButtons: $$('#additionTimeChoices button'),
    startBtn: $('#additionStartBtn'),
    resetBtn: $('#additionResetBtn'),
    answerForm: $('#additionAnswerForm'),
    answer: $('#additionAnswer'),
    answerBtn: $('#additionAnswerBtn'),
    example: $('#additionExample'),
    message: $('#additionMessage'),
    timeLeft: $('#additionTimeLeft'),
    correctCount: $('#additionCorrectCount'),
    wrongCount: $('#additionWrongCount'),
    timeProgress: $('#additionTimeProgress'),
    bankCount: $('#additionBankCount'),
    task: $('#additionTab .task')
  };

  function persistSettings() {
    if (saveSettings) {
      saveSettings({ addition: { duration: state.duration } });
    }
  }

  function updateStats() {
    els.timeLeft.textContent = formatTime(state.secondsLeft);
    els.correctCount.textContent = state.correct;
    els.wrongCount.textContent = state.wrong;
    setProgress(els.timeProgress, state.secondsLeft, state.duration);
  }

  function stopTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
      state.nextTimer = null;
    }
  }

  function pickProblem() {
    if (!ADDITION_BANK.length) {
      return null;
    }
    let item = ADDITION_BANK[Math.floor(Math.random() * ADDITION_BANK.length)];
    let key = item.a + '+' + item.b;
    let guard = 0;
    while (key === state.lastKey && ADDITION_BANK.length > 1 && guard < 40) {
      item = ADDITION_BANK[Math.floor(Math.random() * ADDITION_BANK.length)];
      key = item.a + '+' + item.b;
      guard += 1;
    }
    return item;
  }

  function setNextQuestion(animate) {
    const item = pickProblem();
    state.current = item;
    state.lastKey = item ? item.a + '+' + item.b : null;
    state.questionStartedAt = Date.now();
    const text = item ? item.a + ' + ' + item.b : '—';
    if (animate) {
      animateExample(els.example, text);
    } else {
      els.example.textContent = text;
    }
  }

  function nextQuestion() {
    setNextQuestion(true);
    els.answer.value = '';
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    els.answer.focus();
  }

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !showSessionSummary) {
      return;
    }
    showSessionSummary({
      title: 'Итог: сложение',
      correct: correct != null ? correct : state.correct,
      wrong: wrong != null ? wrong : state.wrong,
      log: entries.slice()
    });
    state.sessionLog = [];
  }

  function finish() {
    stopTimer();
    state.running = false;
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    showMessage(els.message, 'Готово: ' + state.correct + ' верно, ' + state.wrong + ' ошибок', 'good');
    presentSummary();
  }

  function start() {
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.sessionLog = [];
    state.secondsLeft = state.duration;
    state.running = true;
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Сложите числа', '');

    if (state.secondsLeft !== null) {
      state.timer = window.setInterval(function () {
        state.secondsLeft -= 1;
        updateStats();
        if (state.secondsLeft <= 0) {
          finish();
        }
      }, 1000);
    }
  }

  function showIdleExample() {
    els.example.textContent = '—';
    state.current = null;
    state.questionStartedAt = null;
  }

  function reset() {
    const prevCorrect = state.correct;
    const prevWrong = state.wrong;
    const prevLog = state.sessionLog.slice();
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.secondsLeft = state.duration;
    state.running = false;
    showIdleExample();
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    presentSummary(prevCorrect, prevWrong, prevLog);
  }

  function setTime(seconds) {
    state.duration = seconds;
    state.secondsLeft = seconds;
    els.timeButtons.forEach(function (button) {
      setPressed(
        button,
        String(seconds) === button.dataset.seconds || (seconds === null && button.dataset.seconds === 'free')
      );
    });
    updateStats();
    persistSettings();
  }

  function loadSavedSettings() {
    if (!getSettings) {
      return;
    }
    const saved = getSettings().addition || {};
    if (saved.duration === null || typeof saved.duration === 'number') {
      state.duration = saved.duration;
      state.secondsLeft = saved.duration;
    }
    els.timeButtons.forEach(function (button) {
      setPressed(
        button,
        String(state.duration) === button.dataset.seconds ||
          (state.duration === null && button.dataset.seconds === 'free')
      );
    });
  }

  Trainer.stopAddition = function stopAddition() {
    stopTimer();
    state.running = false;
  };

  Trainer.initAddition = function initAddition() {
    loadSavedSettings();
    if (els.bankCount) {
      els.bankCount.textContent = String(ADDITION_BANK.length);
    }

    els.timeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setTime(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds));
      });
    });
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.running || !state.current) {
        return;
      }
      if (els.answer.value.trim() === '') {
        showMessage(els.message, 'Введите сумму', 'bad');
        flashAnswer(els.answer, false);
        return;
      }

      const expected = state.current.answer;
      const isCorrect = Number(els.answer.value) === expected;
      const label = state.current.a + ' + ' + state.current.b + ' = ' + expected;
      // Только локальная сессия — без recordAttempt / глобальной статистики
      pushSessionAttempt(state.sessionLog, label, isCorrect, state.questionStartedAt);

      flashAnswer(els.answer, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        state.correct += 1;
        bumpStat(els.correctCount);
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        state.wrong += 1;
        bumpStat(els.wrongCount);
        showMessage(els.message, 'Ошибка: ' + label, 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        state.nextTimer = window.setTimeout(function () {
          if (state.running) {
            nextQuestion();
          }
        }, 900);
      }
      updateStats();
    });

    reset();
  };
})();
