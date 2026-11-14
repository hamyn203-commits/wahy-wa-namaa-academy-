const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const VideoAsset = require('../models/VideoAsset');
const Lesson = require('../models/Lesson');
const { Quiz } = require('../models/Quiz');

const DEMO_COURSES = [
  {
    slug: 'quran-memorization-beginner',
    title: { ar: 'تحفيظ القرآن — المبتدئ', en: 'Quran Memorization — Beginner', id: 'Menghafal Al-Quran — Pemula' },
    desc: { ar: 'ابدأ حفظ جزء عم مع معلم مجاز', en: 'Start Juz Amma with a certified teacher', id: 'Mulailah menghafal Juz Amma dengan guru bersertifikat' },
    category: 'quran',
    programs: ['general', 'kids'],
  },
  {
    slug: 'quran-kids-fun',
    title: { ar: 'قرآن للأطفال — ممتع', en: 'Quran for Kids — Fun', id: 'Al-Quran untuk Anak-anak — Menyenangkan' },
    desc: { ar: 'حفظ وتجويد للأطفال بأسلوب تفاعلي', en: 'Interactive Quran for children', id: 'Menghafal dan Tajwid untuk anak-anak dengan metode interaktif' },
    category: 'children',
    programs: ['kids'],
  },
  {
    slug: 'reverts-quran-basics',
    title: { ar: 'قرآن للمسلمين الجدد', en: 'Quran for Reverts', id: 'Al-Quran untuk Mualaf' },
    desc: { ar: 'أساسيات القراءة والحفظ للمبتدئين', en: 'Reading and memorization basics', id: 'Dasar-dasar membaca dan menghafal untuk pemula' },
    category: 'quran',
    programs: ['reverts', 'general'],
  },
  {
    slug: 'women-quran-circle',
    title: { ar: 'حلقة قرآن للنساء', en: 'Women Quran Circle', id: 'Halaqah Al-Quran Wanita' },
    desc: { ar: 'حفظ وتجويد في بيئة نسائية آمنة', en: 'Memorization and tajweed for women', id: 'Menghafal dan Tajwid dalam lingkungan wanita yang aman' },
    category: 'quran',
    programs: ['women'],
  },
];

const DEMO_VIDEOS = [
  { title: 'مقدمة في التجويد', titleEn: 'Introduction to Tajweed', category: 'tajweed', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 600, sortOrder: 1 },
  { title: 'تلاوة قرآنية — نموذج', titleEn: 'Quran Recitation Sample', category: 'quran', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 480, sortOrder: 2 },
  { title: 'تعلم الحروف العربية', titleEn: 'Learn Arabic Letters', category: 'arabic', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 420, sortOrder: 3 },
  { title: 'سيرة النبي ﷺ — مقدمة', titleEn: 'Prophet Biography Intro', category: 'seerah', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 720, sortOrder: 4 },
  { title: 'تجويد للأطفال', titleEn: 'Tajweed for Kids', category: 'kids', videoUrl: 'https://www.youtube.com/embed/2Qd_1wstBg0', duration: 360, sortOrder: 5 },
  { title: 'أحكام النون الساكنة', titleEn: 'Noon Sakinah Rules', category: 'tajweed', videoUrl: 'https://www.youtube.com/embed/HGr1BOrrPyY', duration: 540, sortOrder: 6 },
];

async function ensureDemoTeacher() {
  let teacher = await Teacher.findOne({ status: 'approved' });
  if (teacher) return teacher;

  const user = await User.create({
    name: 'الشيخ أحمد محمد',
    email: `teacher-demo-${Date.now()}@wahynamaa.example`,
    password: 'DemoTeacher2024!',
    role: 'teacher',
  });

  return Teacher.create({
    user: user._id,
    personalInfo: { fullName: user.name, age: 35, gender: 'male', country: 'مصر', city: 'القاهرة', phone: '+200000000000' },
    academicInfo: { university: 'الأزهر', faculty: 'الدراسات الإسلامية', graduationYear: 2010, specialization: 'التجويد', qualification: 'إجازة في القرآن' },
    documents: { idCard: '/uploads/demo/id.pdf', graduationCertificate: '/uploads/demo/cert.pdf' },
    media: {
      profilePhoto: '/assets/logo.png',
      introductionVideo: 'https://www.youtube.com/embed/2Qd_1wstBg0',
      recitationVideo: 'https://www.youtube.com/embed/HGr1BOrrPyY',
      teachingMethodVideo: 'https://www.youtube.com/embed/2Qd_1wstBg0',
    },
    quranInfo: { specializations: ['tajweed', 'children'], memorizedParts: 30 },
    status: 'approved',
    isVerified: true,
    isFeatured: true,
    languages: ['arabic', 'english'],
    stats: { totalSessions: 120, totalHours: 120, rating: { average: 4.9, count: 45 } },
  });
}

async function seedLessonsForCourse(course, teacherId) {
  const existingLessons = await Lesson.find({ course: course._id });
  if (existingLessons.length >= 3) {
    return;
  }

  await Lesson.deleteMany({ course: course._id });
  await Quiz.deleteMany({ course: course._id });

  if (course.slug === 'quran-memorization-beginner') {
    const quiz = await Quiz.create({
      title: { ar: 'اختبار جزء عم التقييمي', en: 'Juz Amma Practice Quiz', id: 'Kuis Latihan Juz Amma' },
      description: { ar: 'اختبار قصير لمراجعة القراءة والتجويد', en: 'Short practice quiz to review recitation' },
      course: course._id,
      instructor: teacherId,
      type: 'practice',
      status: 'published',
      publishedAt: new Date(),
      questions: [
        {
          type: 'multiple-choice',
          question: { ar: 'كم عدد آيات سورة الفاتحة؟', en: 'How many verses are in Surah Al-Fatiha?', id: 'Berapa jumlah ayat dalam Surah Al-Fatiha?' },
          options: [
            { text: { ar: '5', en: '5', id: '5' }, isCorrect: false },
            { text: { ar: '7', en: '7', id: '7' }, isCorrect: true },
            { text: { ar: '10', en: '10', id: '10' }, isCorrect: false }
          ],
          points: 10
        },
        {
          type: 'true-false',
          question: { ar: 'سورة الناس هي آخر سورة في القرآن الكريم؟', en: 'Surah An-Nas is the last Surah in the Quran?', id: 'Surah An-Nas adalah Surah terakhir di dalam Al-Quran?' },
          options: [
            { text: { ar: 'صح', en: 'True', id: 'Benar' }, isCorrect: true },
            { text: { ar: 'خطأ', en: 'False', id: 'Salah' }, isCorrect: false }
          ],
          points: 10
        }
      ],
      settings: { passingScore: 60, maxAttempts: 3, shuffleQuestions: false, showResults: 'immediately' }
    });

    const l1 = await Lesson.create({
      title: { ar: 'مقدمة في أحكام التجويد ومخارج الحروف', en: 'Introduction to Tajweed and Articulation', id: 'Pengantar Tajwid dan Artikulasi Huruf' },
      description: { ar: 'فيديو يشرح أساسيات التجويد ومخارج الحروف العربية', en: 'Video explaining the basics of Tajweed rules', id: 'Video yang menjelaskan dasar-dasar hukum Tajwid' },
      slug: 'tajweed-intro',
      course: course._id,
      order: 1,
      type: 'video',
      duration: 15,
      isFree: true,
      isPublished: true,
      publishedAt: new Date(),
      content: { video: { url: 'https://www.youtube.com/embed/2Qd_1wstBg0', provider: 'youtube', duration: 900 } }
    });

    const l2 = await Lesson.create({
      title: { ar: 'دليل تلاوة سورة الفاتحة', en: 'Surah Al-Fatiha Recitation Guide', id: 'Panduan Membaca Surah Al-Fatiha' },
      description: { ar: 'قراءة سورة الفاتحة وتطبيق أحكام الاستعاذة والبسملة ومخارج الحروف', en: 'Reading Surah Al-Fatiha with proper tajweed rules', id: 'Membaca Surah Al-Fatiha dengan hukum tajwid yang benar' },
      slug: 'al-fatiha-guide',
      course: course._id,
      order: 2,
      type: 'text',
      duration: 20,
      isPublished: true,
      publishedAt: new Date(),
      content: {
        text: {
          ar: '## سورة الفاتحة\n\n1. الاستعاذة والبسملة: اقرأهما بوضوح مع مراعاة الغنة والمدود.\n2. مخارج الحروف: انتبه لمخرج الضاد في "الضالين" ومخرج العين في "نعبد".\n3. القراءة المرتلة: كرر القراءة خلف المعلم.',
          en: '## Surah Al-Fatiha\n\n1. Isti\'adhah & Basmalah: Recite them clearly observing correct elongation.\n2. Articulation: Pay close attention to the letter "Dad" in "Al-Dallin" and the letter "Ayn" in "Na\'bud".\n3. Recitation Practice: Repeat after the teacher.',
          id: '## Surah Al-Fatiha\n\n1. Isti\'adzah & Basmalah: Bacalah dengan jelas dengan memperhatikan pemanjangan yang benar.\n2. Artikulasi: Berikan perhatian khusus pada huruf "Dhad" dalam "Al-Dhallin" dan huruf "Ayn" dalam "Na\'bud".\n3. Latihan Membaca: Ulangi setelah guru membaca.'
        }
      }
    });

    const l3 = await Lesson.create({
      title: { ar: 'اختبار جزء عم التقييمي', en: 'Juz Amma Practice Quiz', id: 'Kuis Latihan Juz Amma' },
      slug: 'juz-amma-quiz-lesson',
      course: course._id,
      order: 3,
      type: 'quiz',
      duration: 15,
      isPublished: true,
      publishedAt: new Date(),
      content: { quiz: quiz._id }
    });

    course.lessons = [l1._id, l2._id, l3._id];
    await course.save();

  } else if (course.slug === 'quran-kids-fun') {
    const quiz = await Quiz.create({
      title: { ar: 'اختبار الحروف التفاعلي للأطفال', en: 'Interactive Alphabet Quiz', id: 'Kuis Huruf Arab Interaktif' },
      description: { ar: 'اختبار مرح ومسلٍ للأطفال', en: 'Fun alphabet matching test for kids' },
      course: course._id,
      instructor: teacherId,
      type: 'practice',
      status: 'published',
      publishedAt: new Date(),
      questions: [
        {
          type: 'multiple-choice',
          question: { ar: 'ما هو الحرف الأول في الأبجدية العربية؟', en: 'What is the first letter of the Arabic alphabet?', id: 'Apa huruf pertama dalam alfabet Arab?' },
          options: [
            { text: { ar: 'ب', en: 'Ba', id: 'Ba' }, isCorrect: false },
            { text: { ar: 'أ', en: 'Alif', id: 'Alif' }, isCorrect: true },
            { text: { ar: 'ت', en: 'Ta', id: 'Ta' }, isCorrect: false }
          ],
          points: 10
        }
      ],
      settings: { passingScore: 60, maxAttempts: 3, shuffleQuestions: false, showResults: 'immediately' }
    });

    const l1 = await Lesson.create({
      title: { ar: 'أغنية الحروف العربية للأطفال', en: 'Arabic Letters Song for Kids', id: 'Lagu Huruf Arab untuk Anak-anak' },
      slug: 'letters-song',
      course: course._id,
      order: 1,
      type: 'video',
      duration: 10,
      isFree: true,
      isPublished: true,
      publishedAt: new Date(),
      content: { video: { url: 'https://www.youtube.com/embed/2Qd_1wstBg0', provider: 'youtube', duration: 600 } }
    });

    const l2 = await Lesson.create({
      title: { ar: 'دليل كتابة الحروف العربية الأساسية', en: 'Writing Basic Arabic Shapes', id: 'Menulin Bentuk Dasar Huruf Arab' },
      slug: 'writing-shapes',
      course: course._id,
      order: 2,
      type: 'text',
      duration: 15,
      isPublished: true,
      publishedAt: new Date(),
      content: {
        text: {
          ar: '## كتابة الحروف\n\n- حرف الألف: ارسم خطاً مستقيماً من الأعلى إلى الأسفل.\n- حرف الباء: ارسم طبقاً صغيراً وضع تحته نقطة.',
          en: '## Writing Letters\n\n- Letter Alif: Draw a straight vertical line from top to bottom.\n- Letter Ba: Draw a small plate shape and place a dot underneath.',
          id: '## Menulis Huruf\n\n- Huruf Alif: Gambar garis lurus dari atas ke bawah.\n- Huruf Ba: Gambar bentuk piring kecil dan letakkan titik di bawahnya.'
        }
      }
    });

    const l3 = await Lesson.create({
      title: { ar: 'اختبار الحروف التفاعلي للأطفال', en: 'Interactive Alphabet Quiz', id: 'Kuis Huruf Arab Interaktif' },
      slug: 'alphabet-quiz-lesson',
      course: course._id,
      order: 3,
      type: 'quiz',
      duration: 10,
      isPublished: true,
      publishedAt: new Date(),
      content: { quiz: quiz._id }
    });

    course.lessons = [l1._id, l2._id, l3._id];
    await course.save();

  } else if (course.slug === 'reverts-quran-basics') {
    const quiz = await Quiz.create({
      title: { ar: 'اختبار أساسيات القرآن', en: 'Quran Basics Quiz', id: 'Kuis Dasar-dasar Al-Quran' },
      description: { ar: 'اختبار أساسي للمسلمين الجدد', en: 'Basic test for revert students' },
      course: course._id,
      instructor: teacherId,
      type: 'practice',
      status: 'published',
      publishedAt: new Date(),
      questions: [
        {
          type: 'multiple-choice',
          question: { ar: 'بأي لغة نزل القرآن الكريم؟', en: 'In which language was the Quran revealed?', id: 'Dalam bahasa apa Al-Quran diturunkan?' },
          options: [
            { text: { ar: 'العربية', en: 'Arabic', id: 'Bahasa Arab' }, isCorrect: true },
            { text: { ar: 'الإنجليزية', en: 'English', id: 'Bahasa Inggris' }, isCorrect: false }
          ],
          points: 10
        }
      ],
      settings: { passingScore: 60, maxAttempts: 3, shuffleQuestions: false, showResults: 'immediately' }
    });

    const l1 = await Lesson.create({
      title: { ar: 'كيف نزل القرآن الكريم؟', en: 'How was the Quran Revealed?', id: 'Bagaimana Al-Quran Diturunkan?' },
      slug: 'revelation-intro',
      course: course._id,
      order: 1,
      type: 'video',
      duration: 15,
      isFree: true,
      isPublished: true,
      publishedAt: new Date(),
      content: { video: { url: 'https://www.youtube.com/embed/HGr1BOrrPyY', provider: 'youtube', duration: 900 } }
    });

    const l2 = await Lesson.create({
      title: { ar: 'خطوات بسيطة للبدء في القراءة', en: 'Simple Steps to Start Reading', id: 'Langkah Mudah Mulai Membaca' },
      slug: 'reading-steps',
      course: course._id,
      order: 2,
      type: 'text',
      duration: 20,
      isPublished: true,
      publishedAt: new Date(),
      content: {
        text: {
          ar: '## قراءة القرآن للمبتدئين\n\n1. ابدأ بتعلم الحركات (الفتحة والضمة والكسرة).\n2. تدرب على تهجئة الكلمات القصيرة ببطء.',
          en: '## Reading Quran for Beginners\n\n1. Start by learning the vowels (Fathah, Dammah, Kasrah).\n2. Practice spelling short words slowly.',
          id: '## Membaca Al-Quran untuk Pemula\n\n1. Mulailah dengan mempelajari harakat (Fathah, Dhammah, Kasrah).\n2. Berlatihlah mengeja kata-kata pendek secara perlahan.'
        }
      }
    });

    const l3 = await Lesson.create({
      title: { ar: 'اختبار أساسيات القرآن', en: 'Quran Basics Quiz', id: 'Kuis Dasar-dasar Al-Quran' },
      slug: 'basics-quiz-lesson',
      course: course._id,
      order: 3,
      type: 'quiz',
      duration: 15,
      isPublished: true,
      publishedAt: new Date(),
      content: { quiz: quiz._id }
    });

    course.lessons = [l1._id, l2._id, l3._id];
    await course.save();

  } else if (course.slug === 'women-quran-circle') {
    const quiz = await Quiz.create({
      title: { ar: 'اختبار التجويد لحلقة النساء', en: 'Tajweed Circle Quiz', id: 'Kuis Halaqah Tajwid' },
      description: { ar: 'مراجعة أحكام التجويد للحلقة', en: 'Review of Tajweed rules for the circle' },
      course: course._id,
      instructor: teacherId,
      type: 'practice',
      status: 'published',
      publishedAt: new Date(),
      questions: [
        {
          type: 'multiple-choice',
          question: { ar: 'ما حكم النون والميم المشددتين؟', en: 'What is the rule for doubled Noon and Meem?', id: 'Apa hukum untuk huruf Nun dan Mim bertasydid?' },
          options: [
            { text: { ar: 'الغنة حركتين', en: 'Ghunnah of 2 counts', id: 'Ghunnah 2 harakat' }, isCorrect: true },
            { text: { ar: 'الإظهار بدون غنة', en: 'Izhar without ghunnah', id: 'Izhar tanpa ghunnah' }, isCorrect: false }
          ],
          points: 10
        }
      ],
      settings: { passingScore: 60, maxAttempts: 3, shuffleQuestions: false, showResults: 'immediately' }
    });

    const l1 = await Lesson.create({
      title: { ar: 'أهمية حلقات القرآن الجماعية للنساء', en: 'Importance of Quran Circles for Women', id: 'Pentingnya Halaqah Al-Quran untuk Wanita' },
      slug: 'women-circles-importance',
      course: course._id,
      order: 1,
      type: 'video',
      duration: 12,
      isFree: true,
      isPublished: true,
      publishedAt: new Date(),
      content: { video: { url: 'https://www.youtube.com/embed/2Qd_1wstBg0', provider: 'youtube', duration: 720 } }
    });

    const l2 = await Lesson.create({
      title: { ar: 'آداب تلاوة القرآن الكريم واستماعه', en: 'Etiquettes of Reciting and Listening to Quran', id: 'Adab Membaca dan Mendengarkan Al-Quran' },
      slug: 'recitation-etiquette',
      course: course._id,
      order: 2,
      type: 'text',
      duration: 18,
      isPublished: true,
      publishedAt: new Date(),
      content: {
        text: {
          ar: '## آداب التلاوة والاستماع\n\n1. حضور القلب والخشوع أثناء التلاوة.\n2. الاستماع بإنصات وتفكر في معاني الآيات.',
          en: '## Recitation & Listening Etiquettes\n\n1. Heart presence and humility during recitation.\n2. Listening attentively and contemplating the meanings.',
          id: '## Adab Membaca & Mendengarkan\n\n1. Kehadiran hati dan kekhusyukan saat membaca.\n2. Mendengarkan dengan penuh perhatian dan merenungkan maknanya.'
        }
      }
    });

    const l3 = await Lesson.create({
      title: { ar: 'اختبار التجويد لحلقة النساء', en: 'Tajweed Circle Quiz', id: 'Kuis Halaqah Tajwid' },
      slug: 'tajweed-quiz-lesson',
      course: course._id,
      order: 3,
      type: 'quiz',
      duration: 15,
      isPublished: true,
      publishedAt: new Date(),
      content: { quiz: quiz._id }
    });

    course.lessons = [l1._id, l2._id, l3._id];
    await course.save();
  }
}

router.post('/bootstrap', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const secret = req.headers['x-seed-secret'] || req.body?.secret;
    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const teacher = await ensureDemoTeacher();
    const created = [];

    for (const c of DEMO_COURSES) {
      let course = await Course.findOne({ slug: c.slug });
      if (!course) {
        course = await Course.create({
          title: {
            ar: c.title.ar,
            en: c.title.en,
            id: c.title.id
          },
          description: {
            ar: c.desc.ar,
            en: c.desc.en,
            id: c.desc.id
          },
          slug: c.slug,
          category: c.category,
          programs: c.programs,
          level: 'beginner',
          price: 0,
          currency: 'USD',
          duration: '3 months',
          durationInHours: 20,
          instructor: teacher._id,
          image: '/courses/quran-beginner.jpg',
          status: 'published',
          publishedAt: new Date(),
          certificate: { enabled: true },
          stats: { enrolled: 8, rating: { average: 4.8, count: 5 } },
        });
        created.push(c.slug);
      }

      await seedLessonsForCourse(course, teacher._id);
    }

    const videosCreated = [];
    for (const v of DEMO_VIDEOS) {
      const exists = await VideoAsset.findOne({ title: v.title, category: v.category });
      if (exists) continue;
      await VideoAsset.create(v);
      videosCreated.push(v.title);
    }

    const [teacherCount, courseCount, videoCount] = await Promise.all([
      Teacher.countDocuments({ status: 'approved' }),
      Course.countDocuments({ status: 'published' }),
      VideoAsset.countDocuments({ isPublished: true }),
    ]);

    res.json({
      success: true,
      message: created.length || videosCreated.length ? 'Bootstrap seeded data with lessons' : 'Already seeded courses and lessons',
      created,
      videosCreated,
      teacherCount,
      courseCount,
      videoCount,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
