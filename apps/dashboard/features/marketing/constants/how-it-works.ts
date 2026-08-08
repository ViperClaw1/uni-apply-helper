export type FormField = { label: string; labelEn: string; value: string };

export type HowItWorksSlide =
  | { kind: "form"; step: string; title: string; fields: FormField[] }
  | { kind: "upload" }
  | { kind: "universities" }
  | { kind: "apply" }
  | { kind: "status" };

export const HOW_IT_WORKS_SLIDES: HowItWorksSlide[] = [
  {
    kind: "form",
    step: "Section 1 of 5",
    title: "Basic data · Основные данные",
    fields: [
      { label: "Имя", labelEn: "Given Name", value: "AMINA" },
      { label: "Фамилия", labelEn: "Surname", value: "YUSUPOVA" },
      { label: "Гражданство", labelEn: "Nationality", value: "Kazakhstan" },
      { label: "Номер паспорта", labelEn: "Passport No.", value: "N01234567" },
      { label: "Электронная почта", labelEn: "E-Mail", value: "amina.y@example.com" },
    ],
  },
  {
    kind: "form",
    step: "Section 2 of 5",
    title: "Education data · Данные об образовании",
    fields: [
      { label: "Высшее образование", labelEn: "Highest Degree", value: "Bachelor's" },
      { label: "Учебное заведение", labelEn: "School of Graduation", value: "Al-Farabi KazNU" },
      { label: "Специальность", labelEn: "Major", value: "Computer Science" },
      { label: "Уровень китайского", labelEn: "Chinese level", value: "HSK 4" },
      { label: "Специальность заявки", labelEn: "Application Major", value: "Software Engineering" },
    ],
  },
  {
    kind: "form",
    step: "Section 3 of 5",
    title: "Guarantor data · Данные гаранта",
    fields: [
      { label: "Имя гаранта", labelEn: "Guarantor Name", value: "Bekzat Yusupov" },
      { label: "Телефон гаранта", labelEn: "Guarantor Phone", value: "+7 701 234 5678" },
      { label: "Email гаранта", labelEn: "Guarantor Email", value: "bekzat.y@example.com" },
      { label: "Отношение", labelEn: "Relationship", value: "Father" },
    ],
  },
  {
    kind: "form",
    step: "Section 4 of 5",
    title: "Contact data · Данные контактного лица",
    fields: [
      { label: "Имя контакта", labelEn: "Emergency Name", value: "Dana Yusupova" },
      { label: "Телефон контакта", labelEn: "Emergency Phone", value: "+7 701 987 6543" },
      { label: "Email контакта", labelEn: "Emergency Email", value: "dana.y@example.com" },
      { label: "Отношение", labelEn: "Relationship", value: "Sister" },
    ],
  },
  {
    kind: "form",
    step: "Section 5 of 5",
    title: "Relatives · Родственники",
    fields: [
      { label: "Имя отца", labelEn: "Father's full name", value: "Bekzat Yusupov" },
      { label: "Телефон отца", labelEn: "Father's phone", value: "+7 701 234 5678" },
      { label: "Имя матери", labelEn: "Mother's full name", value: "Aigerim Yusupova" },
      { label: "Телефон матери", labelEn: "Mother's phone", value: "+7 701 111 2233" },
    ],
  },
  { kind: "upload" },
  { kind: "universities" },
  { kind: "apply" },
  { kind: "status" },
];
