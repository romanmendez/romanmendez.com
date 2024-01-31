import { json } from '@remix-run/node'
import { NavLink, Outlet } from '@remix-run/react'
import { cn } from '#app/utils/misc'

export async function loader() {
	return json({})
}

export default function AddRoute() {
	const formSelections = ['teacher', 'student', 'band', 'song']
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-full py-2 px-8 text-base lg:text-xl'

	return (
		<div>
			<header className="container py-6">
				<nav className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap md:gap-8">
					<ul
						className={
							'flex w-full flex-wrap items-center justify-center gap-4 delay-200'
						}
					>
						{formSelections.map(selection => (
							<li key={selection}>
								<NavLink
									to={`/add/${selection}`}
									className={({ isActive }) =>
										isActive
											? cn(navLinkDefaultClassName, 'bg-white text-background')
											: cn(navLinkDefaultClassName, 'hover:bg-white/10')
									}
								>
									<span className="w-full overflow-hidden text-ellipsis text-center text-body-xs ">
										{selection.charAt(0).toUpperCase() + selection.substr(1)}
									</span>
								</NavLink>
							</li>
						))}
					</ul>
				</nav>
			</header>
			<Outlet />
		</div>
	)
}
