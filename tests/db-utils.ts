import fs from 'node:fs'
import { faker } from '@faker-js/faker'
import { type PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { UniqueEnforcer } from 'enforce-unique'

const uniqueUsernameEnforcer = new UniqueEnforcer()
export const instrumentsArray = ['vocals', 'keys', 'guitar', 'bass', 'drums']
export const ageGroupArray = ['rookie', 'rock101', 'performance', 'adults']

type InstrumentType = (typeof instrumentsArray)[number]
type AgeGroupType = (typeof ageGroupArray)[number]

function randomInstrument() {
	return instrumentsArray[
		faker.number.int({ min: 0, max: instrumentsArray.length - 1 })
	]
}

export function createUser() {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()

	const username = uniqueUsernameEnforcer
		.enforce(() => {
			return (
				faker.string.alphanumeric({ length: 2 }) +
				'_' +
				faker.internet.userName({
					firstName: firstName.toLowerCase(),
					lastName: lastName.toLowerCase(),
				})
			)
		})
		.slice(0, 20)
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')
	return {
		username,
		name: `${firstName} ${lastName}`,
		email: `${username}@example.com`,
	}
}

export function createSong() {
	const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

	return {
		title: faker.music.songName(),
		artist: faker.word.words({ count: { min: 1, max: 3 } }),
		description: faker.lorem.paragraph({ min: 1, max: 3 }),
		key: `${keys[faker.number.int({ min: 0, max: keys.length - 1 })]}${
			Math.random() < 0.5 ? 'm' : ''
		}`,
		bpm: faker.number.int({ min: 60, max: 200 }).toString(),
	}
}

export function createStudent({
	ageGroup,
}: {
	instrument?: InstrumentType
	ageGroup?: AgeGroupType
} = {}) {
	let dob = faker.date.birthdate({ min: 6, mode: 'age' })
	if (ageGroup) {
		switch (ageGroup) {
			case 'rookie':
				dob = faker.date.birthdate({ min: 6, max: 8, mode: 'age' })
				break
			case 'rock101':
				dob = faker.date.birthdate({ min: 8, max: 12, mode: 'age' })
				break
			case 'performance':
				dob = faker.date.birthdate({ min: 12, max: 18, mode: 'age' })
				break
			case 'adults':
				dob = faker.date.birthdate({ min: 18, mode: 'age' })
				break
			default:
				dob = faker.date.birthdate({ min: 6, mode: 'age' })
		}
	}
	return {
		name: faker.person.fullName(),
		username: faker.internet.userName(),
		dob,
	}
}

export function createLesson() {
	const newDate = new Date(2024, 1, 1, 15, 45, 0).toString()
	const schedule = `${newDate.slice(0, 3)} ${newDate.slice(16, 21)}`

	const instrument = randomInstrument()

	return {
		instrument,
		schedule,
	}
}

export function createPassword(password: string = faker.internet.password()) {
	return {
		hash: bcrypt.hashSync(password, 10),
	}
}

let noteImages: Array<Awaited<ReturnType<typeof img>>> | undefined
export async function getNoteImages() {
	if (noteImages) return noteImages

	noteImages = await Promise.all([
		img({
			altText: 'a nice country house',
			filepath: './tests/fixtures/images/notes/0.png',
		}),
		img({
			altText: 'a city scape',
			filepath: './tests/fixtures/images/notes/1.png',
		}),
		img({
			altText: 'a sunrise',
			filepath: './tests/fixtures/images/notes/2.png',
		}),
		img({
			altText: 'a group of friends',
			filepath: './tests/fixtures/images/notes/3.png',
		}),
		img({
			altText: 'friends being inclusive of someone who looks lonely',
			filepath: './tests/fixtures/images/notes/4.png',
		}),
		img({
			altText: 'an illustration of a hot air balloon',
			filepath: './tests/fixtures/images/notes/5.png',
		}),
		img({
			altText:
				'an office full of laptops and other office equipment that look like it was abandoned in a rush out of the building in an emergency years ago.',
			filepath: './tests/fixtures/images/notes/6.png',
		}),
		img({
			altText: 'a rusty lock',
			filepath: './tests/fixtures/images/notes/7.png',
		}),
		img({
			altText: 'something very happy in nature',
			filepath: './tests/fixtures/images/notes/8.png',
		}),
		img({
			altText: `someone at the end of a cry session who's starting to feel a little better.`,
			filepath: './tests/fixtures/images/notes/9.png',
		}),
	])

	return noteImages
}

let userImages: Array<Awaited<ReturnType<typeof img>>> | undefined
export async function getUserImages() {
	if (userImages) return userImages

	userImages = await Promise.all(
		Array.from({ length: 10 }, (_, index) =>
			img({ filepath: `./tests/fixtures/images/user/${index}.jpg` }),
		),
	)

	return userImages
}

let studentImages: Array<Awaited<ReturnType<typeof img>>> | undefined
export async function getStudentImages() {
	if (studentImages) return studentImages

	studentImages = await Promise.all(
		Array.from({ length: 20 }, (_, index) =>
			img({ filepath: `./tests/fixtures/images/student/${index}.jpeg` }),
		),
	)

	return studentImages
}

export async function img({
	altText,
	filepath,
}: {
	altText?: string
	filepath: string
}) {
	return {
		altText,
		contentType: filepath.endsWith('.png') ? 'image/png' : 'image/jpeg',
		blob: await fs.promises.readFile(filepath),
	}
}

export async function cleanupDb(prisma: PrismaClient) {
	const tables = await prisma.$queryRaw<
		{ name: string }[]
	>`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`

	await prisma.$transaction([
		// Disable FK constraints to avoid relation conflicts during deletion
		prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`),
		// Delete all rows from each table, preserving table structures
		...tables.map(({ name }) =>
			prisma.$executeRawUnsafe(`DELETE from "${name}"`),
		),
		prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`),
	])
}
