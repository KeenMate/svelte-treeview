export default [
	{
		nodePath: "1",
		name:     "Germany",
		users:    10000,

		hasChildren: true,
		members:     [
			{username: "Standa Novak", email: "standaniv@mail.com"},
			{username: "Kuba Novak", email: "novakub@mail.com"}
		],
		rules:       [{name: "country", value: "Germany"}]
	},
	{
		nodePath:    "1.2",
		name:        "Munich",
		users:       1000,
		hasChildren: true,
		members:     [
			{username: "Petr Novak", email: "standaniv@mail.com"},
			{username: "Honza Novak", email: "novakub@mail.com"}
		],
		rules:       [{name: "city", value: "Munich"}]
	},
	{
		nodePath: "1.2.5",
		name:     "Sort Facility",
		users:    500,

		hasChildren: false,
		members:     [{username: "Standa Novak", email: "standaniv@mail.com"}],
		rules:       [{name: "property", value: "Sorting facility A001"}]
	},
	{
		nodePath: "1.3",
		name:     "Frankfurt",
		users:    1000,

		hasChildren: false,
		members:     [
			{username: "Stanek Novak", email: "standaniv@mail.com"},
			{username: "Daniel Novak", email: "novakub@mail.com"}
		],
		rules:       [{name: "city", value: "Frankfurt"}]
	},
	{
		nodePath: "4",
		name:     "France",
		users:    50000,

		hasChildren: false,
		members:     [
			{username: "Patrik Novak", email: "standaniv@mail.com"},
			{username: "Marian Novak", email: "novakub@mail.com"}
		],
		rules:       [{name: "country", value: "France"}]
	}
]
