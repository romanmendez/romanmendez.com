import { faker } from '@faker-js/faker'
import { type Student } from '@prisma/client'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	ageGroupArray,
	cleanupDb,
	createPassword,
	createStudent,
	createUser,
	getLessonTimes,
	getProfileImages,
	img,
	instrumentsArray,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await cleanupDb(prisma)
	console.timeEnd('🧹 Cleaned up the database...')

	console.time('🔑 Created permissions...')
	const entities = ['user', 'note']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				await prisma.permission.create({ data: { entity, action, access } })
			}
		}
	}
	console.timeEnd('🔑 Created permissions...')

	console.time('👑 Created roles...')
	await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'any' },
				}),
			},
		},
	})
	await prisma.role.create({
		data: {
			name: 'teacher',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	console.timeEnd('👑 Created roles...')

	const totalBands = 20
	console.time(`🎵 Created ${totalBands} bands...`)
	Array.from({ length: totalBands }, async (_, index) => {
		const ageGroup = ageGroupArray[index % ageGroupArray.length]
		const times = getLessonTimes()
		const schedule = times[index % times.length]
		return await prisma.band.create({
			select: { id: true },
			data: {
				name: `${ageGroup} ${schedule}`,
				ageGroup,
				schedule,
			},
		})
	})
	console.timeEnd(`🎵 Created ${totalBands} bands...`)

	const totalTeachers = 5
	console.time(`📚 Created ${totalTeachers} teachers...`)
	const teacherImages = await getProfileImages({
		profile: 'teacher',
		amount: totalTeachers,
	})
	const teacherUsers = await Promise.all(
		Array.from({ length: totalTeachers }, async (_, index) => {
			return await prisma.user.create({
				select: {
					teacher: { select: { id: true, instruments: true } },
				},
				data: {
					...createUser(),
					image: { create: teacherImages[index % teacherImages.length] },
					teacher: {
						create: {
							name: faker.person.fullName(),
							bio: faker.lorem.paragraph(1),
							instruments: instrumentsArray[index],
						},
					},
				},
			})
		}),
	)
	const teachers = teacherUsers.map(user => user.teacher)
	console.timeEnd(`📚 Created ${totalTeachers} teachers...`)

	const totalStudents = 60
	console.time(`🥁 Created ${totalStudents} students...`)
	const studentImages = await getProfileImages({
		profile: 'student',
		amount: totalStudents,
	})
	const studentsByInstrument: Record<
		(typeof instrumentsArray)[number],
		Pick<Student, 'id' | 'instrument'>[]
	> = instrumentsArray.reduce<Record<string, any>>((obj, inst: string) => {
		return { ...obj, [inst]: [] }
	}, {})

	for (
		let instrumentIndex = 0;
		instrumentIndex < instrumentsArray.length;
		instrumentIndex++
	) {
		const instrument = instrumentsArray[instrumentIndex]
		const teacher = teachers.find(t => t?.instruments.includes(instrument))
		const instrumentStudentGroup = await Promise.all(
			Array.from(
				{ length: totalStudents / instrumentsArray.length },
				async (_, index) => {
					const ageGroup = ageGroupArray[index % ageGroupArray.length]
					const studentData = createStudent({ instrument, ageGroup })

					return await prisma.student.create({
						select: { id: true, instrument: true },
						data: {
							...studentData,
							...(teacher
								? {
										teachers: {
											connect: teacher,
										},
								  }
								: {}),
							image: { create: studentImages[index % studentImages.length] },
						},
					})
				},
			),
		)
		studentsByInstrument[instrument] = instrumentStudentGroup
	}
	console.timeEnd(`🥁 Created ${totalStudents} students...`)

	const commentsPerStudent = 10
	console.time(`📝 Created ${commentsPerStudent} comments...`)
	for (const instrument in studentsByInstrument) {
		studentsByInstrument[instrument].forEach(async student => {
			const teacher = await prisma.teacher.findFirstOrThrow({
				select: { id: true },
				where: { instruments: { contains: instrument } },
			})
			const masterDate = faker.date.recent()
			for (let index = 0; index < commentsPerStudent; index++) {
				const date = new Date(masterDate.setDate(masterDate.getDate() - 7))
				await prisma.comment.create({
					select: { id: true },
					data: {
						content: faker.lorem.paragraphs(1),
						authorId: teacher.id,
						studentId: student.id,
						updatedAt: date,
					},
				})
			}
		})
	}
	console.timeEnd(`📝 Created ${commentsPerStudent} comments...`)

	console.time(`🐨 Created admin user "kody"`)

	const kodyImages = await promiseHash({
		kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
		cuteKoala: img({
			altText: 'an adorable koala cartoon illustration',
			filepath: './tests/fixtures/images/kody-notes/cute-koala.png',
		}),
		koalaEating: img({
			altText: 'a cartoon illustration of a koala in a tree eating',
			filepath: './tests/fixtures/images/kody-notes/koala-eating.png',
		}),
		koalaCuddle: img({
			altText: 'a cartoon illustration of koalas cuddling',
			filepath: './tests/fixtures/images/kody-notes/koala-cuddle.png',
		}),
		mountain: img({
			altText: 'a beautiful mountain covered in snow',
			filepath: './tests/fixtures/images/kody-notes/mountain.png',
		}),
		koalaCoder: img({
			altText: 'a koala coding at the computer',
			filepath: './tests/fixtures/images/kody-notes/koala-coder.png',
		}),
		koalaMentor: img({
			altText:
				'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
			filepath: './tests/fixtures/images/kody-notes/koala-mentor.png',
		}),
		koalaSoccer: img({
			altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
			filepath: './tests/fixtures/images/kody-notes/koala-soccer.png',
		}),
	})

	const githubUser = await insertGitHubUser('MOCK_CODE_GITHUB_KODY')

	await prisma.user.create({
		select: { id: true },
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			image: { create: kodyImages.kodyUser },
			teacher: {
				create: {
					instruments: 'drums',
					name: 'Kody',
				},
			},
			password: { create: createPassword('kodylovesyou') },
			connections: {
				create: { providerName: 'github', providerId: githubUser.profile.id },
			},
			roles: { connect: [{ name: 'admin' }, { name: 'teacher' }] },
		},
	})
	console.timeEnd(`🐨 Created admin user "kody"`)

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
