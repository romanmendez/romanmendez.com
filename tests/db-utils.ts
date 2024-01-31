import fs from 'node:fs'
import { faker } from '@faker-js/faker'
import { type Song, type PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { UniqueEnforcer } from 'enforce-unique'
import { type AgeGroup, type Instrument, instrumentsArray } from '#prisma/seed'

const uniqueUsernameEnforcer = new UniqueEnforcer()

export function randomInstrument() {
	return instrumentsArray[
		faker.number.int({ min: 0, max: instrumentsArray.length - 1 })
	]
}

export function getLessonSchedule() {
	const day = faker.date.weekday({ abbreviated: true })
	const hours = Array.from({ length: 22 - 15 }, (_, i) => i + 15)
	const minutes = Array.from({ length: 4 }, (_, i) =>
		i * 15 === 0 ? '00' : (i * 15).toString(),
	)
	const schedule = []
	for (let x = 0; x < hours.length; x++) {
		for (let y = 0; y < minutes.length; y++) {
			schedule.push(`${day} ${hours[x]}:${minutes[y]}`)
		}
	}
	return schedule
}

export async function createUser() {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()
	const [image] = await getProfileImages({ profile: 'teacher', amount: 1 })

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
		email: `${username}@example.com`,
		image: { create: image },
	}
}

export function createSong(): Omit<Song, 'id' | 'createdAt' | 'updatedAt'> {
	const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

	return {
		title: faker.music.songName(),
		artist: faker.word.words({ count: { min: 1, max: 3 } }),
		description: faker.lorem.paragraph({ min: 1, max: 3 }),
		key: `${keys[faker.number.int({ min: 0, max: keys.length - 1 })]}${
			Math.random() < 0.5 ? 'm' : ''
		}`,
		bpm: faker.number.int({ min: 60, max: 200 }).toString(),
		lyrics: faker.lorem.paragraphs(4),
	}
}

export async function createStudent({
	ageGroup,
	instrument,
}: {
	instrument?: Instrument
	ageGroup?: AgeGroup
} = {}) {
	let dob = faker.date.birthdate({ min: 6, mode: 'age' })
	instrument ??= randomInstrument()
	const [image] = await getProfileImages({ profile: 'student', amount: 1 })

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
		instrument,
		dob,
		image: { create: image },
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

export async function getProfileImages({
	profile,
	amount,
}: {
	profile: string
	amount: number
}): Promise<Array<Awaited<ReturnType<typeof img>>>> {
	const randomIndex: number[] = []
	for (let index = 0; index < amount; index++) {
		randomIndex.push(faker.number.int({ min: 0, max: 19 }))
	}
	const images = await Promise.all(
		Array.from({ length: amount }, (_, index) =>
			img({
				filepath: `./tests/fixtures/images/${profile}/${randomIndex[index]}.jpeg`,
			}),
		),
	)

	return images
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
