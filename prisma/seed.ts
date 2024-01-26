import { faker } from '@faker-js/faker'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	ageGroupArray,
	cleanupDb,
	createPassword,
	createSong,
	createStudent,
	createUser,
	getLessonSchedule,
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

	const totalTeachers = instrumentsArray.length
	console.time(`📚 Created ${totalTeachers} teachers...`)
	const teacherImages = await getProfileImages({
		profile: 'teacher',
		amount: totalTeachers,
	})
	const drumTeacher = await prisma.teacher.create({
		select: { id: true },
		data: {
			name: faker.person.fullName(),
			bio: faker.lorem.paragraph(1),
			instruments: 'drums',
			user: {
				create: {
					...createUser(),
					image: { create: teacherImages[0] },
				},
			},
		},
	})
	const bassTeacher = await prisma.teacher.create({
		select: { id: true },
		data: {
			name: faker.person.fullName(),
			bio: faker.lorem.paragraph(1),
			instruments: 'bass',
			user: {
				create: {
					...createUser(),
					image: { create: teacherImages[1] },
				},
			},
		},
	})
	const keysTeacher = await prisma.teacher.create({
		select: { id: true },
		data: {
			name: faker.person.fullName(),
			bio: faker.lorem.paragraph(1),
			instruments: 'keys',
			user: {
				create: {
					...createUser(),
					image: { create: teacherImages[2] },
				},
			},
		},
	})
	const guitarTeacher = await prisma.teacher.create({
		select: { id: true },
		data: {
			name: faker.person.fullName(),
			bio: faker.lorem.paragraph(1),
			instruments: 'guitar',
			user: {
				create: {
					...createUser(),
					image: { create: teacherImages[3] },
				},
			},
		},
	})
	const vocalsTeacher = await prisma.teacher.create({
		select: { id: true },
		data: {
			name: faker.person.fullName(),
			bio: faker.lorem.paragraph(1),
			instruments: 'vocals',
			user: {
				create: {
					...createUser(),
					image: { create: teacherImages[4] },
				},
			},
		},
	})
	const teachers = [
		drumTeacher,
		bassTeacher,
		guitarTeacher,
		keysTeacher,
		vocalsTeacher,
	]
	console.timeEnd(`📚 Created ${totalTeachers} teachers...`)

	const totalStudents = instrumentsArray.length + ageGroupArray.length
	console.time(`🎓 Created ${totalStudents} students...`)
	const studentImages = await getProfileImages({
		profile: 'student',
		amount: totalStudents,
	})
	const drumsStudents = await Promise.all(
		Array.from({ length: ageGroupArray.length }, async (_, index) => {
			const drummers = await prisma.student.create({
				select: { id: true },
				data: {
					...createStudent({
						ageGroup: ageGroupArray[index],
						instrument: 'drums',
					}),
					image: { create: studentImages[index] },
				},
			})
			return drummers
		}),
	)
	const bassStudents = await Promise.all(
		Array.from({ length: ageGroupArray.length }, async (_, index) => {
			const bassists = await prisma.student.create({
				select: { id: true },
				data: {
					...createStudent({
						ageGroup: ageGroupArray[index],
						instrument: 'bass',
					}),
					image: { create: studentImages[index + 4] },
				},
			})
			return bassists
		}),
	)
	const keysStudents = await Promise.all(
		Array.from({ length: ageGroupArray.length }, async (_, index) => {
			const keyboardists = await prisma.student.create({
				select: { id: true },
				data: {
					...createStudent({
						ageGroup: ageGroupArray[index],
						instrument: 'keys',
					}),
					image: { create: studentImages[index + 8] },
				},
			})
			return keyboardists
		}),
	)
	const guitarStudents = await Promise.all(
		Array.from({ length: ageGroupArray.length }, async (_, index) => {
			const guitarrists = await prisma.student.create({
				select: { id: true },
				data: {
					...createStudent({
						ageGroup: ageGroupArray[index],
						instrument: 'guitar',
					}),
					image: { create: studentImages[index + 12] },
				},
			})
			return guitarrists
		}),
	)
	const vocalStudents = await Promise.all(
		Array.from({ length: ageGroupArray.length }, async (_, index) => {
			const vocalists = await prisma.student.create({
				select: { id: true },
				data: {
					...createStudent({
						ageGroup: ageGroupArray[index],
						instrument: 'vocals',
					}),
					image: { create: studentImages[index + 16] },
				},
			})
			return vocalists
		}),
	)
	const students = [
		drumsStudents,
		bassStudents,
		keysStudents,
		guitarStudents,
		vocalStudents,
	]
	console.timeEnd(`🎓 Created ${totalStudents} students...`)

	console.time(`🧂 Created 1 season...`)
	const season = await prisma.season.create({
		select: { id: true },
		data: {
			startDate: faker.date.recent(),
		},
	})
	console.timeEnd(`🧂 Created 1 season...`)

	const totalBands = ageGroupArray.length
	console.time(`🎵 Created ${totalBands} bands...`)
	Array.from({ length: totalBands }, async (_, index) => {
		const ageGroup = ageGroupArray[index % ageGroupArray.length]
		const times = getLessonSchedule()
		const schedule = times[index % times.length]
		const songs = await createSong(4)
		return await prisma.band.create({
			select: { id: true },
			data: {
				name: `${
					ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)
				} ${schedule}`,
				ageGroup,
				schedule,
				setlists: {
					create: {
						theme: faker.music.genre(),
						seasonId: season.id,
						songs: {
							create: [
								{
									...songs[0],

									students: {
										connect: [
											drumsStudents[index],
											bassStudents[index],
											keysStudents[index],
											guitarStudents[index],
											vocalStudents[index],
										],
									},
									comments: {
										create: [
											{
												content: faker.lorem.paragraphs(1),
												authorId: drumTeacher.id,
												mentions: { connect: drumsStudents[index] },
											},
											{
												content: faker.lorem.paragraphs(1),
												authorId: bassTeacher.id,
												mentions: { connect: bassStudents[index] },
											},
											{
												content: faker.lorem.paragraphs(1),
												authorId: keysTeacher.id,
												mentions: { connect: keysStudents[index] },
											},
											{
												content: faker.lorem.paragraphs(1),
												authorId: guitarTeacher.id,
												mentions: { connect: guitarStudents[index] },
											},
											{
												content: faker.lorem.paragraphs(1),
												authorId: vocalsTeacher.id,
												mentions: { connect: vocalStudents[index] },
											},
											{
												content: faker.lorem.paragraphs(1),
												authorId: teachers[index % teachers.length].id,
												mentions: {
													connect: [
														drumsStudents[index],
														bassStudents[index],
														keysStudents[index],
														guitarStudents[index],
														vocalStudents[index],
													],
												},
											},
										],
									},
								},
							],
						},
					},
				},
				students: {
					connect: [
						drumsStudents[index],
						bassStudents[index],
						keysStudents[index],
						guitarStudents[index],
						vocalStudents[index],
					],
				},
				teachers: {
					connect: teachers[index % teachers.length],
				},
			},
		})
	})
	console.timeEnd(`🎵 Created ${totalBands} bands...`)

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
