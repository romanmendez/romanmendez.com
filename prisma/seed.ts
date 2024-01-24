import { faker } from '@faker-js/faker'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import {
	ageGroupArray,
	cleanupDb,
	createPassword,
	createStudent,
	createUser,
	getLessonSchedule,
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

	const totalBands = 12
	console.time(`🎵 Created ${totalBands} bands...`)
	const studentImages = await getProfileImages({
		profile: 'student',
		amount: totalBands * instrumentsArray.length,
	})
	Array.from({ length: totalBands }, async (_, index) => {
		const ageGroup = ageGroupArray[index % ageGroupArray.length]
		const times = getLessonSchedule()
		const schedule = times[index % times.length]
		return await prisma.band.create({
			select: { id: true },
			data: {
				name: `${
					ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)
				} ${schedule}`,
				ageGroup,
				schedule,
				students: {
					create: [
						{
							...createStudent({ ageGroup, instrument: 'drums' }),
							image: { create: studentImages[index] },
							teachers: { connect: drumTeacher },
							comments: {
								create: [
									{
										content: faker.lorem.paragraphs(1),
										authorId: drumTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: drumTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: drumTeacher.id,
									},
								],
							},
						},
						{
							...createStudent({ ageGroup, instrument: 'bass' }),
							image: { create: studentImages[index + 1] },
							teachers: { connect: bassTeacher },
							comments: {
								create: [
									{
										content: faker.lorem.paragraphs(1),
										authorId: bassTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: bassTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: bassTeacher.id,
									},
								],
							},
						},
						{
							...createStudent({ ageGroup, instrument: 'keys' }),
							image: { create: studentImages[index + 2] },
							teachers: { connect: keysTeacher },
							comments: {
								create: [
									{
										content: faker.lorem.paragraphs(1),
										authorId: keysTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: keysTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: keysTeacher.id,
									},
								],
							},
						},
						{
							...createStudent({ ageGroup, instrument: 'guitar' }),
							image: { create: studentImages[index + 3] },
							teachers: { connect: guitarTeacher },
							comments: {
								create: [
									{
										content: faker.lorem.paragraphs(1),
										authorId: guitarTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: guitarTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: guitarTeacher.id,
									},
								],
							},
						},
						{
							...createStudent({ ageGroup, instrument: 'vocals' }),
							image: { create: studentImages[index + 4] },
							teachers: { connect: vocalsTeacher },
							comments: {
								create: [
									{
										content: faker.lorem.paragraphs(1),
										authorId: vocalsTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: vocalsTeacher.id,
									},
									{
										content: faker.lorem.paragraphs(1),
										authorId: vocalsTeacher.id,
									},
								],
							},
						},
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
