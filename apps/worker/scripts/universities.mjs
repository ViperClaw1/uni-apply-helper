export const UNIVERSITIES = {
  'zhengzhou-university': {
    id: 'zhengzhou-university',
    displayName: 'Zhengzhou University',
    loginUrl: 'https://zzu.17gz.org/member/login.do',
    formUrl: 'https://zzu.17gz.org/apply/index.do',
    platform: '17gz',
  },
  kmmc: {
    id: 'kmmc',
    displayName: 'Kunming Medical University',
    loginUrl: 'http://study.kmmc.cn/member/login.do',
    formUrl: 'http://study.kmmc.cn/apply/index.do',
    platform: '17gz',
  },
  'shandong-university': {
    id: 'shandong-university',
    displayName: 'Shandong University (SDU)',
    loginUrl: 'http://www.apply.sdu.edu.cn/en/student/login',
    formUrl: 'http://www.apply.sdu.edu.cn/en/student/apply/create',
    platform: 'cucas',
  },
};

export function resolveUniversityId(argv = process.argv.slice(2)) {
  const fromFlag = argv.find((arg) => arg.startsWith('--university='))?.split('=')[1];
  const fromShortFlagIndex = argv.indexOf('--university');
  const fromShortFlag =
    fromShortFlagIndex >= 0 ? argv[fromShortFlagIndex + 1] : undefined;

  return (
    process.env.UNIVERSITY_ID?.trim() ||
    fromFlag?.trim() ||
    fromShortFlag?.trim() ||
    'zhengzhou-university'
  );
}

export function getUniversity(universityId) {
  const university = UNIVERSITIES[universityId];

  if (!university) {
    const available = Object.keys(UNIVERSITIES).join(', ');
    throw new Error(
      `Unknown university "${universityId}". Available: ${available}`,
    );
  }

  return university;
}
