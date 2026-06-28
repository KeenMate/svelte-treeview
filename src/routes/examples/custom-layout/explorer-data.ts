// Mock filesystem for the Windows File Explorer demo (WindowsExplorer.svelte).
//
// Modelled on a real Windows 10 `C:\Windows` install — ~30 folders at the
// Windows root, each with multi-level subfolders and files. Subfolders are
// populated with realistic files so the per-folder search has plenty to match;
// a handful of folders are left empty on purpose to show the empty-state. Paths
// are ltree paths ("1", "1.4", "1.4.6.25.1"). Folders carry size=null; files
// carry a byte size + extension. Dates are pre-formatted (DD.MM.YYYY HH:MM) so
// the demo stays deterministic and avoids Date.now().

export interface FsNode {
	id: number;
	path: string;
	name: string;
	kind: 'folder' | 'file';
	ext: string; // '' for folders (and extensionless files)
	modified: string;
	size: number | null; // bytes; null for folders
}

// ── tree builder ─────────────────────────────────────────────────────────────
// Authoring the structure as a nested literal keeps paths correct automatically;
// hand-numbering 300+ paths would be unmaintainable.

interface FileSpec {
	name: string;
	modified: string;
	size: number;
}
interface DirSpec {
	name: string;
	modified?: string;
	dirs?: DirSpec[];
	files?: FileSpec[];
}

const nodes: FsNode[] = [];
let _id = 0;
const DEFAULT_DIR_DATE = '12.05.2026 09:30';

const f = (name: string, modified: string, size: number): FileSpec => ({ name, modified, size });

function extOf(name: string): string {
	const i = name.lastIndexOf('.');
	return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

function build(spec: DirSpec, path: string): void {
	nodes.push({
		id: ++_id,
		path,
		name: spec.name,
		kind: 'folder',
		ext: '',
		modified: spec.modified ?? DEFAULT_DIR_DATE,
		size: null
	});
	let seg = 0;
	for (const d of spec.dirs ?? []) build(d, `${path}.${++seg}`);
	for (const file of spec.files ?? []) {
		nodes.push({
			id: ++_id,
			path: `${path}.${++seg}`,
			name: file.name,
			kind: 'file',
			ext: extOf(file.name),
			modified: file.modified,
			size: file.size
		});
	}
}

// ── the tree ─────────────────────────────────────────────────────────────────
// This PC > Local Disk (C:) > Windows (the deep one). Windows lands at path
// "1.4.6" (6th child of Local Disk); DEFAULT_PATH below points the explorer there.

const root: DirSpec = {
	name: 'This PC',
	modified: '01.01.2026 00:00',
	dirs: [
		// Library folders (browsable, so they carry a few files)
		{
			name: 'Music',
			modified: '14.03.2026 18:22',
			files: [
				f('Chill Mix.mp3', '14.03.2026 18:22', 8429120),
				f('Focus.mp3', '12.03.2026 07:15', 6122880),
				f('Roadtrip.flac', '02.03.2026 19:40', 38110720)
			]
		},
		{
			name: 'Pictures',
			modified: '22.04.2026 09:10',
			files: [
				f('Vacation.jpg', '22.04.2026 09:10', 3829110),
				f('Logo.png', '20.04.2026 13:02', 184320),
				f('Screenshot.png', '18.04.2026 21:55', 421889)
			]
		},
		{
			name: 'Videos',
			modified: '02.02.2026 21:40',
			files: [f('Demo.mp4', '02.02.2026 21:40', 84292100), f('Capture.mov', '28.01.2026 16:10', 152043500)]
		},

		// ── Local Disk (C:) ──────────────────────────────────────────────────
		{
			name: 'Local Disk (C:)',
			modified: '01.03.2026 16:07',
			dirs: [
				{
					name: 'PerfLogs',
					modified: '07.12.2019 10:14',
					files: [f('WinSAT.log', '20.06.2026 11:20', 14820), f('Admin.etl', '20.06.2026 11:20', 524288)]
				},
				{
					name: 'Program Files',
					modified: '26.06.2026 03:34',
					dirs: [
						{
							name: 'Common Files',
							dirs: [{ name: 'microsoft shared' }, { name: 'System' }],
							files: [f('readme.txt', '12.04.2026 08:00', 1042)]
						},
						{
							name: 'Internet Explorer',
							files: [f('iexplore.exe', '07.12.2019 10:14', 811520), f('ExtExport.exe', '07.12.2019 10:14', 49152)]
						},
						{ name: 'Windows NT', modified: '07.12.2019 10:14', files: [f('readme.txt', '07.12.2019 10:14', 220)] }
					],
					files: [f('desktop.ini', '07.12.2019 10:14', 174)]
				},
				{
					name: 'Program Files (x86)',
					modified: '31.05.2026 13:30',
					dirs: [{ name: 'Common Files' }, { name: 'Microsoft' }],
					files: [f('desktop.ini', '31.05.2026 13:30', 174)]
				},
				{
					name: 'ProgramData',
					modified: '25.05.2026 09:47',
					files: [f('settings.json', '25.05.2026 09:47', 4820), f('telemetry.log', '24.05.2026 22:10', 88210)]
				},
				{
					name: 'Users',
					modified: '11.02.2026 08:20',
					dirs: [
						{
							name: 'Public',
							dirs: [
								{ name: 'Documents', files: [f('Shared notes.txt', '02.02.2026 09:00', 1280)] },
								{ name: 'Downloads' }, // empty
								{ name: 'Desktop', files: [f('desktop.ini', '02.02.2026 09:00', 174)] }
							]
						},
						{
							name: 'ondrej',
							dirs: [
								{
									name: 'Documents',
									files: [f('budget.xlsx', '10.06.2026 14:02', 28714), f('notes.txt', '02.06.2026 09:40', 1820)]
								},
								{
									name: 'Downloads',
									files: [
										f('installer.exe', '20.06.2026 11:20', 74810880),
										f('archive.zip', '18.06.2026 19:33', 10548240)
									]
								},
								{
									name: 'Desktop',
									files: [
										f('Visual Studio Code.lnk', '11.02.2026 08:20', 1842),
										f('Recycle notes.txt', '09.06.2026 12:00', 410)
									]
								}
							]
						}
					]
				},

				// ── C:\Windows — the rich, multi-level folder ──────────────────
				{
					name: 'Windows',
					modified: '24.06.2026 13:10',
					dirs: [
						{
							name: 'AppReadiness',
							modified: '07.12.2019 10:14',
							files: [f('StateChange.xml', '15.10.2025 18:00', 2210)]
						},
						{
							name: 'Boot',
							modified: '07.12.2019 10:14',
							dirs: [
								{ name: 'DVD', files: [f('boot.sdi', '07.12.2019 10:14', 3174400)] },
								{ name: 'EFI', files: [f('bootmgfw.efi', '07.12.2019 10:14', 1456128), f('bootmgr.efi', '07.12.2019 10:14', 1495040)] },
								{
									name: 'Fonts',
									files: [
										f('segoe_slboot.ttf', '07.12.2019 10:14', 78972),
										f('wgl4_boot.ttf', '07.12.2019 10:14', 44612),
										f('chs_boot.ttf', '07.12.2019 10:14', 3527984)
									]
								},
								{ name: 'Resources', files: [f('bootres.dll', '07.12.2019 10:14', 90112)] }
							],
							files: [f('BootDebuggerFiles.ini', '07.12.2019 10:14', 32), f('memtest.exe', '07.12.2019 10:14', 1167360)]
						},
						{
							name: 'Branding',
							dirs: [
								{ name: 'Basebrd', files: [f('basebrd.dll', '07.12.2019 10:14', 71680)] },
								{ name: 'ShellBrd', files: [f('shellbrd.dll', '07.12.2019 10:14', 8704)] }
							]
						},
						{
							name: 'Containers',
							modified: '14.04.2026 11:31',
							files: [f('layers.json', '14.04.2026 11:31', 18420)]
						},
						{
							name: 'Cursors',
							modified: '07.12.2019 10:14',
							files: [
								f('aero_arrow.cur', '07.12.2019 10:14', 4286),
								f('aero_busy.ani', '07.12.2019 10:14', 110656),
								f('aero_link.cur', '07.12.2019 10:14', 5350),
								f('aero_pen.cur', '07.12.2019 10:14', 4286),
								f('aero_unavail.cur', '07.12.2019 10:14', 5350),
								f('wait_l.cur', '07.12.2019 10:14', 9662)
							]
						},
						{
							name: 'Fonts',
							modified: '20.06.2026 22:14',
							files: [
								f('arial.ttf', '07.12.2019 10:14', 1036584),
								f('calibri.ttf', '07.12.2019 10:14', 1648120),
								f('consola.ttf', '07.12.2019 10:14', 459180),
								f('segoeui.ttf', '07.12.2019 10:14', 955804),
								f('tahoma.ttf', '07.12.2019 10:14', 939280),
								f('times.ttf', '07.12.2019 10:14', 1100672),
								f('verdana.ttf', '07.12.2019 10:14', 663356)
							]
						},
						{
							name: 'Globalization',
							modified: '02.09.2025 11:44',
							dirs: [
								{ name: 'ELS', files: [f('els.dll', '07.12.2019 10:14', 124928)] },
								{ name: 'ICU', files: [f('icudt68l.dat', '07.12.2019 10:14', 27594832)] },
								{ name: 'Sorting', files: [f('sortdefault.nls', '07.12.2019 10:14', 3825832)] },
								{ name: 'Time Zone', files: [f('tzres.dll', '07.12.2019 10:14', 2048)] }
							]
						},
						{
							name: 'Help',
							dirs: [
								{ name: 'Windows', files: [f('windows.chm', '07.12.2019 10:14', 188210)] },
								{ name: 'en-US', files: [f('credits.rtf', '07.12.2019 10:14', 84210)] },
								{ name: 'mui', files: [f('help.dll.mui', '07.12.2019 10:14', 16384)] }
							]
						},
						{
							name: 'IME',
							modified: '02.09.2025 11:44',
							dirs: [{ name: 'IMEJP', files: [f('imjpdct.dic', '02.09.2025 11:44', 2410240)] }, { name: 'IMETC' }]
						},
						{
							name: 'INF',
							modified: '22.06.2026 10:29',
							dirs: [
								{ name: 'BITS', files: [f('bits.inf', '07.12.2019 10:14', 4210)] },
								{ name: 'ASP.NET', files: [f('aspnet.inf', '07.12.2019 10:14', 3820)] }
							],
							files: [
								f('1394.inf', '07.12.2019 10:14', 12468),
								f('61883.inf', '07.12.2019 10:14', 8910),
								f('usbport.inf', '07.12.2019 10:14', 45120),
								f('netnb.inf', '07.12.2019 10:14', 3204)
							]
						},
						{
							name: 'Installer',
							modified: '12.04.2026 08:00',
							files: [
								f('{90160000}.msi', '12.04.2026 08:00', 4821504),
								f('SourceHash.ini', '12.04.2026 08:00', 1024)
							]
						},
						{
							name: 'L2Schemas',
							modified: '07.12.2019 10:14',
							files: [f('OneXEncryptedHeader.xsd', '07.12.2019 10:14', 4820), f('LandingPage.xsd', '07.12.2019 10:14', 6210)]
						},
						{
							name: 'Logs',
							modified: '28.06.2026 14:34',
							dirs: [
								{
									name: 'CBS',
									files: [
										f('CBS.log', '28.06.2026 14:34', 1842110),
										f('CbsPersist_20260601.log', '01.06.2026 03:12', 30412800)
									]
								},
								{ name: 'DISM', files: [f('dism.log', '20.06.2026 11:20', 422118)] },
								{ name: 'WindowsUpdate', files: [f('WindowsUpdate.log', '28.06.2026 14:29', 276)] },
								{ name: 'MoSetup', files: [f('BlueBox.log', '15.10.2025 18:00', 88210)] }
							]
						},
						{
							name: 'Media',
							modified: '07.12.2019 10:14',
							dirs: [
								{ name: 'Afternoon', files: [f('Windows Logon.wav', '07.12.2019 10:14', 1102842)] },
								{ name: 'Calligraphy', files: [f('Windows Logon.wav', '07.12.2019 10:14', 1102842)] },
								{ name: 'Cityscape', files: [f('Windows Logon.wav', '07.12.2019 10:14', 1102842)] }
							],
							files: [
								f('Alarm01.wav', '07.12.2019 10:14', 198452),
								f('Alarm02.wav', '07.12.2019 10:14', 174228),
								f('chimes.wav', '07.12.2019 10:14', 15920),
								f('ding.wav', '07.12.2019 10:14', 32412),
								f('notify.wav', '07.12.2019 10:14', 60488),
								f('tada.wav', '07.12.2019 10:14', 96412),
								f('Windows Logon.wav', '07.12.2019 10:14', 1102842)
							]
						},
						{
							name: 'Microsoft.NET',
							modified: '11.06.2026 19:40',
							dirs: [
								{ name: 'Framework', files: [f('netfxperf.dll', '07.12.2019 10:14', 49152)] },
								{
									name: 'Framework64',
									dirs: [
										{ name: 'v2.0.50727', files: [f('mscorwks.dll', '07.12.2019 10:14', 5859904)] },
										{ name: 'v3.5', files: [f('msbuild.exe', '07.12.2019 10:14', 110592)] },
										{
											name: 'v4.0.30319',
											files: [
												f('csc.exe', '07.12.2019 10:14', 2419016),
												f('clr.dll', '07.12.2019 10:14', 10242560),
												f('mscorlib.dll', '07.12.2019 10:14', 5664072)
											]
										}
									],
									files: [f('SharedReg12.dll', '07.12.2019 10:14', 32256)]
								},
								{
									name: 'assembly',
									dirs: [
										{ name: 'GAC_MSIL', files: [f('index.dat', '11.06.2026 19:40', 2048)] },
										{ name: 'GAC_64', files: [f('index.dat', '11.06.2026 19:40', 2048)] }
									]
								}
							]
						},
						{
							name: 'PolicyDefinitions',
							dirs: [
								{
									name: 'en-US',
									files: [f('AutoPlay.adml', '07.12.2019 10:14', 18420), f('Biometrics.adml', '07.12.2019 10:14', 9220)]
								}
							],
							files: [
								f('AutoPlay.admx', '07.12.2019 10:14', 14210),
								f('Biometrics.admx', '07.12.2019 10:14', 7430),
								f('AppPrivacy.admx', '07.12.2019 10:14', 88120),
								f('WindowsUpdate.admx', '07.12.2019 10:14', 64880)
							]
						},
						{ name: 'Prefetch', modified: '28.06.2026 14:30' }, // empty (kept empty to demo empty-state)
						{
							name: 'Provisioning',
							dirs: [
								{ name: 'Autologger', files: [f('AutoLogger-Diagtrack.etl', '15.10.2025 18:00', 1048576)] },
								{ name: 'Packages', files: [f('manifest.xml', '15.10.2025 18:00', 4820)] }
							]
						},
						{
							name: 'Resources',
							dirs: [
								{
									name: 'Themes',
									dirs: [{ name: 'aero', files: [f('aero.msstyles', '07.12.2019 10:14', 8523776)] }],
									files: [f('aero.theme', '07.12.2019 10:14', 2832), f('dark.theme', '15.10.2025 18:00', 2890)]
								},
								{ name: 'Ease of Access Themes', files: [f('hcwhite.theme', '07.12.2019 10:14', 2412)] }
							]
						},
						{
							name: 'security',
							dirs: [
								{ name: 'Database', files: [f('secedit.sdb', '14.05.2025 09:00', 1294336)] },
								{ name: 'Logs', files: [f('scesetup.log', '14.05.2025 09:00', 42118)] },
								{ name: 'templates', files: [f('setup security.inf', '14.05.2025 09:00', 88210)] }
							]
						},
						{
							name: 'ServiceProfiles',
							dirs: [
								{ name: 'LocalService', files: [f('NTUSER.DAT', '28.06.2026 14:00', 262144)] },
								{ name: 'NetworkService', files: [f('NTUSER.DAT', '28.06.2026 14:00', 262144)] }
							]
						},
						{
							name: 'Setup',
							dirs: [
								{ name: 'State', files: [f('State.ini', '07.12.2019 10:14', 88)] },
								{ name: 'Scripts', files: [f('SetupComplete.cmd', '15.10.2025 18:00', 412)] }
							]
						},
						{
							name: 'SoftwareDistribution',
							modified: '28.06.2026 06:00',
							dirs: [
								{ name: 'Download', files: [f('manifest.cab', '28.06.2026 06:00', 84210), f('install.esd', '28.06.2026 06:00', 3884204032)] },
								{ name: 'DataStore', files: [f('DataStore.edb', '28.06.2026 06:00', 41943040)] }
							]
						},
						{
							name: 'Speech',
							dirs: [
								{ name: 'Engines', dirs: [{ name: 'TTS', files: [f('en-US-7-Desktop.bin', '14.05.2025 09:00', 4194304)] }] },
								{ name: 'Common', files: [f('sapi.dll', '14.05.2025 09:00', 1421312)] }
							]
						},
						{
							name: 'System32',
							modified: '28.06.2026 14:29',
							dirs: [
								{
									name: 'drivers',
									dirs: [
										{
											name: 'etc',
											files: [
												f('hosts', '07.12.2019 10:14', 824),
												f('networks', '07.12.2019 10:14', 407),
												f('protocol', '07.12.2019 10:14', 1358),
												f('services', '07.12.2019 10:14', 17849)
											]
										},
										{ name: 'UMDF', files: [f('WUDFRd.sys', '14.05.2025 09:00', 245760)] }
									],
									files: [
										f('ntfs.sys', '14.05.2025 09:00', 2848256),
										f('tcpip.sys', '14.05.2025 09:00', 3792896),
										f('disk.sys', '14.05.2025 09:00', 152064)
									]
								},
								{
									name: 'spool',
									dirs: [
										{ name: 'PRINTERS', files: [f('readme.txt', '14.05.2025 09:00', 120)] },
										{ name: 'drivers', files: [f('mxdwdrv.dll', '14.05.2025 09:00', 1648640)] },
										{ name: 'prtprocs', files: [f('winprint.dll', '14.05.2025 09:00', 79360)] }
									]
								},
								{
									name: 'wbem',
									dirs: [{ name: 'Repository', files: [f('OBJECTS.DATA', '28.06.2026 14:00', 26214400)] }],
									files: [f('wmiprvse.exe', '14.05.2025 09:00', 496640), f('WmiPerfClass.dll', '14.05.2025 09:00', 188416)]
								},
								{
									name: 'config',
									files: [
										f('SYSTEM', '28.06.2026 14:29', 18874368),
										f('SOFTWARE', '28.06.2026 14:29', 94371840),
										f('SAM', '28.06.2026 14:29', 65536),
										f('DEFAULT', '28.06.2026 14:29', 524288)
									]
								},
								{ name: 'en-US', files: [f('kernel32.dll.mui', '14.05.2025 09:00', 32768), f('shell32.dll.mui', '14.05.2025 09:00', 524288)] },
								{ name: 'Tasks', files: [f('SA.dat', '28.06.2026 14:00', 1024)] }
							],
							files: [
								f('cmd.exe', '14.05.2025 09:00', 323584),
								f('kernel32.dll', '14.05.2025 09:00', 774472),
								f('notepad.exe', '14.05.2025 09:00', 200704),
								f('shell32.dll', '14.05.2025 09:00', 8704512),
								f('user32.dll', '14.05.2025 09:00', 1648640),
								f('ntdll.dll', '14.05.2025 09:00', 1994920),
								f('taskmgr.exe', '14.05.2025 09:00', 1238016)
							]
						},
						{
							name: 'SysWOW64',
							modified: '14.05.2025 09:00',
							dirs: [
								{ name: 'drivers', files: [f('vmci.sys', '14.05.2025 09:00', 98304)] },
								{ name: 'en-US', files: [f('kernel32.dll.mui', '14.05.2025 09:00', 28672)] }
							],
							files: [
								f('cmd.exe', '14.05.2025 09:00', 289792),
								f('kernel32.dll', '14.05.2025 09:00', 645000),
								f('msvcrt.dll', '14.05.2025 09:00', 692736)
							]
						},
						{
							name: 'SystemApps',
							modified: '15.10.2025 18:00',
							dirs: [{ name: 'Microsoft.Windows.StartMenuExperienceHost', files: [f('StartMenuExperienceHost.exe', '15.10.2025 18:00', 1648640)] }]
						},
						{
							name: 'Tasks',
							modified: '28.06.2026 09:00',
							files: [f('SA.dat', '28.06.2026 09:00', 1024)]
						},
						{ name: 'Temp', modified: '28.06.2026 14:00' }, // empty (kept empty to demo empty-state)
						{
							name: 'Web',
							modified: '13.03.2024 12:00',
							dirs: [
								{ name: '4K', dirs: [{ name: 'Wallpaper', dirs: [{ name: 'Windows', files: [f('img0_3840x2160.jpg', '13.03.2024 12:00', 1933312)] }] }] },
								{
									name: 'Screen',
									files: [
										f('img100.jpg', '07.12.2019 10:14', 1233920),
										f('img101.png', '07.12.2019 10:14', 884736),
										f('img103.png', '07.12.2019 10:14', 921600)
									]
								},
								{
									name: 'Wallpaper',
									dirs: [
										{ name: 'Windows', files: [f('img0.jpg', '07.12.2019 10:14', 393630)] },
										{
											name: 'Theme1',
											files: [
												f('img1.jpg', '07.12.2019 10:14', 825400),
												f('img2.jpg', '07.12.2019 10:14', 791220),
												f('img3.jpg', '07.12.2019 10:14', 768010)
											]
										},
										{ name: 'Theme2', files: [f('img7.jpg', '07.12.2019 10:14', 812340), f('img8.jpg', '07.12.2019 10:14', 798120)] },
										{ name: 'Spotlight', files: [f('spotlight1.jpg', '15.10.2025 18:00', 921344)] }
									]
								}
							]
						},
						{
							name: 'WinSxS',
							modified: '20.06.2026 22:14',
							dirs: [{ name: 'Manifests', files: [f('manifest.cat', '20.06.2026 22:14', 16384)] }, { name: 'Temp' }],
							files: [f('pending.xml', '20.06.2026 22:14', 124210), f('poqexec.log', '20.06.2026 22:14', 42118)]
						},
						{
							name: 'addins',
							modified: '07.12.2019 10:14',
							files: [f('FXSEXT.ecf', '07.12.2019 10:14', 6210)]
						}
					],
					files: [
						f('explorer.exe', '15.10.2025 18:00', 6089584),
						f('notepad.exe', '14.05.2025 09:00', 200704),
						f('regedit.exe', '15.05.2024 09:00', 370176),
						f('HelpPane.exe', '14.05.2025 09:00', 1065984),
						f('bfsvc.exe', '12.02.2025 09:00', 93696),
						f('splwow64.exe', '09.07.2025 09:00', 164352),
						f('write.exe', '14.05.2025 09:00', 11776),
						f('hh.exe', '07.12.2019 10:14', 18432),
						f('win.ini', '07.12.2019 10:14', 92),
						f('system.ini', '07.12.2019 10:14', 219),
						f('WindowsUpdate.log', '28.06.2026 14:29', 276),
						f('setupact.log', '28.06.2026 14:34', 7903619),
						f('DirectX.log', '25.10.2025 09:00', 200245),
						f('mib.bin', '07.12.2019 10:14', 43580)
					]
				}
			]
		}
	]
};

build(root, '1');

export const explorerData: FsNode[] = nodes;

// The explorer opens here — C:\Windows (6th child of Local Disk (C:)).
export const DEFAULT_PATH = '1.4.6';
