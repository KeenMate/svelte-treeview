type PerformanceData = {
  path: string;
  name: string;
  type: string;
  icon: string;
  itemCount: number;
};

export function createPerformanceTestTree(totalNodes: number = 37500, maxDepth: number = 4): PerformanceData[] {
  const nodes: PerformanceData[] = [];
  const nodesByLevel: Map<number, string[]> = new Map();
  
  // Random data generators
  const categories = ['Documents', 'Projects', 'Media', 'Reports', 'Analytics', 'Resources', 'Templates', 'Archives'];
  const subcategories = ['Financial', 'Marketing', 'Technical', 'Legal', 'HR', 'Operations', 'Research', 'Development'];
  const items = ['Report', 'Presentation', 'Spreadsheet', 'Document', 'Image', 'Video', 'Audio', 'Dataset'];
  const icons = ['📁', '📊', '📄', '📈', '💼', '🔧', '🎨', '📋', '🗂️', '📑'];
  const types = ['folder', 'file', 'category', 'subcategory', 'item', 'document'];

  // Calculate nodes per level using exponential distribution
  const nodesPerLevel: number[] = [];
  const branchingFactor = Math.pow(totalNodes, 1 / maxDepth);
  
  for (let level = 0; level < maxDepth; level++) {
    if (level === 0) {
      nodesPerLevel[level] = Math.max(1, Math.floor(Math.pow(branchingFactor, 0.7)));
    } else {
      const remaining = totalNodes - nodes.length;
      const levelsRemaining = maxDepth - level;
      nodesPerLevel[level] = Math.floor(remaining / (levelsRemaining * 1.5));
    }
    nodesByLevel.set(level, []);
  }

  // Ensure we don't exceed totalNodes
  const actualTotal = nodesPerLevel.reduce((sum, count) => sum + count, 0);
  if (actualTotal > totalNodes) {
    const excess = actualTotal - totalNodes;
    nodesPerLevel[maxDepth - 1] -= excess;
  }

  let nodeCounter = 0;

  // Generate nodes level by level
  for (let level = 0; level < maxDepth && nodeCounter < totalNodes; level++) {
    const targetNodesForLevel = Math.min(nodesPerLevel[level], totalNodes - nodeCounter);
    
    if (level === 0) {
      // Generate root nodes
      for (let i = 1; i <= targetNodesForLevel && nodeCounter < totalNodes; i++) {
        const path = `${i}`;
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        
        nodes.push({
          path,
          name: `${randomCategory} ${i}`,
          type: 'category',
          icon: randomIcon,
          itemCount: Math.floor(Math.random() * 50) + 1
        });
        
        nodesByLevel.get(0)?.push(path);
        nodeCounter++;
      }
    } else {
      // Generate child nodes for previous level
      const parentNodes = nodesByLevel.get(level - 1) || [];
      const nodesPerParent = Math.max(1, Math.floor(targetNodesForLevel / parentNodes.length));
      
      let childIndex = 1;
      
      for (const parentPath of parentNodes) {
        const actualChildCount = Math.min(
          nodesPerParent + Math.floor(Math.random() * 3) - 1, // Add some randomness
          Math.floor((totalNodes - nodeCounter) / Math.max(1, parentNodes.length - parentNodes.indexOf(parentPath)))
        );
        
        for (let j = 1; j <= actualChildCount && nodeCounter < totalNodes; j++) {
          const path = `${parentPath}.${childIndex}`;
          
          let name: string;
          let type: string;
          let icon: string;
          
          if (level === 1) {
            const randomSubcat = subcategories[Math.floor(Math.random() * subcategories.length)];
            name = `${randomSubcat} ${childIndex}`;
            type = 'subcategory';
            icon = icons[Math.floor(Math.random() * 4)]; // First 4 icons for subcategories
          } else if (level === maxDepth - 1) {
            const randomItem = items[Math.floor(Math.random() * items.length)];
            name = `${randomItem}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}.${getRandomExtension()}`;
            type = 'file';
            icon = getIconForType(name);
          } else {
            const randomItem = items[Math.floor(Math.random() * items.length)];
            name = `${randomItem} Group ${childIndex}`;
            type = 'item';
            icon = icons[Math.floor(Math.random() * icons.length)];
          }
          
          nodes.push({
            path,
            name,
            type,
            icon,
            itemCount: type === 'file' ? 0 : Math.floor(Math.random() * 20) + 1
          });
          
          nodesByLevel.get(level)?.push(path);
          nodeCounter++;
          childIndex++;
        }
      }
    }
  }

  return nodes;
}

// Helper function to get random file extensions
function getRandomExtension(): string {
  const extensions = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'json', 'xml', 'png', 'jpg', 'mp4', 'mp3'];
  return extensions[Math.floor(Math.random() * extensions.length)];
}

// Helper function to get appropriate icon for file type
function getIconForType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: { [key: string]: string } = {
    'pdf': '📄',
    'docx': '📝',
    'doc': '📝',
    'xlsx': '📊',
    'xls': '📊',
    'pptx': '📈',
    'ppt': '📈',
    'txt': '📄',
    'csv': '📊',
    'json': '🗂️',
    'xml': '🗂️',
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'mp4': '🎥',
    'avi': '🎥',
    'mp3': '🎵',
    'wav': '🎵'
  };
  return iconMap[ext || ''] || '📄';
}

export type DepartmentData = {
  path: string;
  name: string;
  type: string;
  icon: string;
  manager?: string;
  organizationCode?: string;
  employeeCount?: number;
};

export type FilesData = {
  path: string;
  name: string;
  type: string;
  icon: string;
  size?: string;
  contentType?: string;
  lastModified?: string;
  permissions?: string;
};

export function createSampleFilesTree(): FilesData[] {
  // Sample hierarchical data representing a file system or organization structure
  const sampleData: FilesData[] = [
    // Root level
    {
      path: "1",
      name: "Documents",
      type: "folder",
      icon: "📁",
      permissions: "rwx",
    },
    {
      path: "2",
      name: "Projects",
      type: "folder",
      icon: "📁",
      permissions: "rwx",
    },
    {
      path: "3",
      name: "Media",
      type: "folder",
      icon: "📁",
      permissions: "rwx",
    },

    // Documents children
    {
      path: "1.1",
      name: "Reports",
      type: "folder",
      icon: "📄",
      permissions: "rwx",
    },
    {
      path: "1.2",
      name: "Presentations",
      type: "folder",
      icon: "📊",
      permissions: "rwx",
    },
    {
      path: "1.3",
      name: "Templates",
      type: "folder",
      icon: "📋",
      permissions: "rwx",
    },

    // Documents/Reports children
    {
      path: "1.1.1",
      name: "Q1-2024.pdf",
      type: "file",
      icon: "📄",
      size: "2.4 MB",
      contentType: "application/pdf",
      lastModified: "2024-03-31",
      permissions: "rw-",
    },
    {
      path: "1.1.2",
      name: "Q2-2024.pdf",
      type: "file",
      icon: "📄",
      size: "1.8 MB",
      contentType: "application/pdf",
      lastModified: "2024-06-30",
      permissions: "rw-",
    },
    {
      path: "1.1.3",
      name: "Annual-Report.pdf",
      type: "file",
      icon: "📄",
      size: "12.7 MB",
      contentType: "application/pdf",
      lastModified: "2024-12-31",
      permissions: "rw-",
    },

    // Documents/Presentations children
    {
      path: "1.2.1",
      name: "Company-Overview.pptx",
      type: "file",
      icon: "📊",
      size: "8.3 MB",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      lastModified: "2024-02-15",
      permissions: "rw-",
    },
    {
      path: "1.2.2",
      name: "Product-Launch.pptx",
      type: "file",
      icon: "📊",
      size: "15.2 MB",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      lastModified: "2024-08-10",
      permissions: "rw-",
    },

    // Projects children
    {
      path: "2.1",
      name: "Web Development",
      type: "folder",
      icon: "🌐",
    },
    {
      path: "2.2",
      name: "Mobile Apps",
      type: "folder",
      icon: "📱",
    },
    {
      path: "2.3",
      name: "Data Science",
      type: "folder",
      icon: "📊",
    },

    // Projects/Web Development children
    {
      path: "2.1.1",
      name: "E-commerce Site",
      type: "project",
      icon: "🛒",
    },
    {
      path: "2.1.2",
      name: "Portfolio Website",
      type: "project",
      icon: "💼",
    },
    {
      path: "2.1.3",
      name: "Blog Platform",
      type: "project",
      icon: "📝",
    },

    // Projects/Web Development/E-commerce Site children
    {
      path: "2.1.1.1",
      name: "Frontend",
      type: "folder",
      icon: "🎨",
    },
    {
      path: "2.1.1.2",
      name: "Backend",
      type: "folder",
      icon: "⚙️",
    },
    {
      path: "2.1.1.3",
      name: "Database",
      type: "folder",
      icon: "🗄️",
    },

    // Projects/Mobile Apps children
    {
      path: "2.2.1",
      name: "iOS App",
      type: "project",
      icon: "📱",
    },
    {
      path: "2.2.2",
      name: "Android App",
      type: "project",
      icon: "🤖",
    },

    // Media children
    {
      path: "3.1",
      name: "Images",
      type: "folder",
      icon: "🖼️",
    },
    {
      path: "3.2",
      name: "Videos",
      type: "folder",
      icon: "🎥",
    },
    {
      path: "3.3",
      name: "Audio",
      type: "folder",
      icon: "🎵",
    },

    // Media/Images children
    {
      path: "3.1.1",
      name: "Screenshots",
      type: "folder",
      icon: "📷",
    },
    {
      path: "3.1.2",
      name: "Logos",
      type: "folder",
      icon: "🏷️",
    },
    {
      path: "3.1.3",
      name: "Photos",
      type: "folder",
      icon: "📸",
    },

    // Media/Images/Screenshots children
    {
      path: "3.1.1.1",
      name: "app-screenshot-1.png",
      type: "file",
      icon: "📷",
      size: "1.2 MB",
      contentType: "image/png",
      lastModified: "2024-07-15",
      permissions: "rw-",
    },
    {
      path: "3.1.1.2",
      name: "app-screenshot-2.png",
      type: "file",
      icon: "📷",
      size: "980 KB",
      contentType: "image/png",
      lastModified: "2024-07-15",
      permissions: "rw-",
    },
    {
      path: "3.1.1.3",
      name: "desktop-capture.png",
      type: "file",
      icon: "📷",
      size: "3.4 MB",
      contentType: "image/png",
      lastModified: "2024-08-20",
      permissions: "rw-",
    },
  ];

  return sampleData;
}

export function createDepartmentTree(): DepartmentData[] {
  // Sample organizational structure
  const orgData: DepartmentData[] = [
    // Company
    {
      path: "1",
      name: "TechCorp Inc.",
      type: "company",
      icon: "🏢",
      manager: "CEO John Anderson",
      organizationCode: "TECH001",
      employeeCount: 850,
    },

    // Departments
    {
      path: "1.1",
      name: "Engineering",
      type: "department",
      icon: "⚙️",
      manager: "Sarah Williams",
      organizationCode: "ENG",
      employeeCount: 180,
    },
    {
      path: "1.2",
      name: "Marketing",
      type: "department",
      icon: "📢",
      manager: "Michael Chen",
      organizationCode: "MKT",
      employeeCount: 45,
    },
    {
      path: "1.3",
      name: "Sales",
      type: "department",
      icon: "💰",
      manager: "Jennifer Martinez",
      organizationCode: "SAL",
      employeeCount: 120,
    },
    {
      path: "1.4",
      name: "HR",
      type: "department",
      icon: "👥",
      manager: "Robert Taylor",
      organizationCode: "HR",
      employeeCount: 25,
    },

    // Engineering teams
    {
      path: "1.1.1",
      name: "Frontend Team",
      type: "team",
      icon: "🎨",
      manager: "Alice Johnson",
      organizationCode: "ENG-FE",
      employeeCount: 8,
    },
    {
      path: "1.1.2",
      name: "Backend Team",
      type: "team",
      icon: "🔧",
      manager: "David Brown",
      organizationCode: "ENG-BE",
      employeeCount: 12,
    },
    {
      path: "1.1.3",
      name: "DevOps Team",
      type: "team",
      icon: "☁️",
      manager: "Lisa Kumar",
      organizationCode: "ENG-OPS",
      employeeCount: 6,
    },
    {
      path: "1.1.4",
      name: "QA Team",
      type: "team",
      icon: "🧪",
      manager: "James Rodriguez",
      organizationCode: "ENG-QA",
      employeeCount: 10,
    },

    // Frontend Team members
    {
      path: "1.1.1.1",
      name: "Alice Johnson - Lead Developer",
      type: "person",
      icon: "👩‍💻",
      manager: "Sarah Williams",
      organizationCode: "ENG-FE-001",
      employeeCount: 0,
    },
    {
      path: "1.1.1.2",
      name: "Bob Smith - Senior Developer",
      type: "person",
      icon: "👨‍💻",
      manager: "Alice Johnson",
      organizationCode: "ENG-FE-002",
      employeeCount: 0,
    },
    {
      path: "1.1.1.3",
      name: "Carol White - Junior Developer",
      type: "person",
      icon: "👩‍💻",
      manager: "Alice Johnson",
      organizationCode: "ENG-FE-003",
      employeeCount: 0,
    },

    // Backend Team members
    {
      path: "1.1.2.1",
      name: "David Brown - Tech Lead",
      type: "person",
      icon: "👨‍💻",
      manager: "Sarah Williams",
      organizationCode: "ENG-BE-001",
      employeeCount: 0,
    },
    {
      path: "1.1.2.2",
      name: "Emma Davis - Senior Developer",
      type: "person",
      icon: "👩‍💻",
      manager: "David Brown",
      organizationCode: "ENG-BE-002",
      employeeCount: 0,
    },
    {
      path: "1.1.2.3",
      name: "Frank Wilson - Database Specialist",
      type: "person",
      icon: "👨‍💻",
      manager: "David Brown",
      organizationCode: "ENG-BE-003",
      employeeCount: 0,
    },

    // Marketing teams
    {
      path: "1.2.1",
      name: "Digital Marketing",
      type: "team",
      icon: "📱",
      manager: "Jessica Thompson",
      organizationCode: "MKT-DIG",
      employeeCount: 12,
    },
    {
      path: "1.2.2",
      name: "Content Marketing",
      type: "team",
      icon: "✍️",
      manager: "Mark Stevens",
      organizationCode: "MKT-CON",
      employeeCount: 8,
    },
    {
      path: "1.2.3",
      name: "Brand Marketing",
      type: "team",
      icon: "🎨",
      manager: "Amanda Foster",
      organizationCode: "MKT-BRA",
      employeeCount: 6,
    },

    // Sales teams
    {
      path: "1.3.1",
      name: "Enterprise Sales",
      type: "team",
      icon: "🏢",
      manager: "Thomas Anderson",
      organizationCode: "SAL-ENT",
      employeeCount: 35,
    },
    {
      path: "1.3.2",
      name: "SMB Sales",
      type: "team",
      icon: "🏪",
      manager: "Rachel Green",
      organizationCode: "SAL-SMB",
      employeeCount: 28,
    },
    {
      path: "1.3.3",
      name: "Customer Success",
      type: "team",
      icon: "🤝",
      manager: "Kevin Park",
      organizationCode: "SAL-CS",
      employeeCount: 15,
    },
  ];

  return orgData;
}

// Animal data type
export type AnimalData = {
  path: string;
  name: string;
  type: "category" | "animal";
  icon: string;
  species?: string;
  habitat?: string;
  dangerLevel?: "low" | "medium" | "high";
  size?: "small" | "medium" | "large" | "extra-large";
  isDraggable?: boolean;
};

// Zoo zone data type
export type ZooZoneData = {
  path: string;
  name: string;
  type: "zone" | "section" | "enclosure";
  icon: string;
  capacity?: number;
  currentAnimals?: string[];
  requirements?: string[];
  isDroppable?: boolean;
};

export function createAnimalsData(): AnimalData[] {
  const animalsData: AnimalData[] = [
    // Mammals
    {
      path: "1",
      name: "Mammals",
      type: "category",
      icon: "🐾",
    },
    {
      path: "1.1",
      name: "Lion",
      type: "animal",
      icon: "🦁",
      species: "Panthera leo",
      habitat: "Savanna",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "1.2",
      name: "Tiger",
      type: "animal",
      icon: "🐅",
      species: "Panthera tigris",
      habitat: "Forest",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "1.3",
      name: "Bear",
      type: "animal",
      icon: "🐻",
      species: "Ursus americanus",
      habitat: "Forest",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "1.4",
      name: "Elephant",
      type: "animal",
      icon: "🐘",
      species: "Loxodonta africana",
      habitat: "Savanna",
      dangerLevel: "medium",
      size: "extra-large",
      isDraggable: true,
    },
    {
      path: "1.5",
      name: "Giraffe",
      type: "animal",
      icon: "🦒",
      species: "Giraffa camelopardalis",
      habitat: "Savanna",
      dangerLevel: "low",
      size: "extra-large",
      isDraggable: true,
    },
    {
      path: "1.6",
      name: "Zebra",
      type: "animal",
      icon: "🦓",
      species: "Equus zebra",
      habitat: "Savanna",
      dangerLevel: "low",
      size: "medium",
      isDraggable: true,
    },
    {
      path: "1.7",
      name: "Monkey",
      type: "animal",
      icon: "🐵",
      species: "Macaca mulatta",
      habitat: "Forest",
      dangerLevel: "medium",
      size: "small",
      isDraggable: true,
    },
    {
      path: "1.8",
      name: "Panda",
      type: "animal",
      icon: "🐼",
      species: "Ailuropoda melanoleuca",
      habitat: "Forest",
      dangerLevel: "low",
      size: "large",
      isDraggable: true,
    },

    // Birds
    {
      path: "2",
      name: "Birds",
      type: "category",
      icon: "🪶",
    },
    {
      path: "2.1",
      name: "Eagle",
      type: "animal",
      icon: "🦅",
      species: "Aquila chrysaetos",
      habitat: "Mountains",
      dangerLevel: "medium",
      size: "medium",
      isDraggable: true,
    },
    {
      path: "2.2",
      name: "Parrot",
      type: "animal",
      icon: "🦜",
      species: "Ara macao",
      habitat: "Rainforest",
      dangerLevel: "low",
      size: "small",
      isDraggable: true,
    },
    {
      path: "2.3",
      name: "Owl",
      type: "animal",
      icon: "🦉",
      species: "Bubo bubo",
      habitat: "Forest",
      dangerLevel: "low",
      size: "small",
      isDraggable: true,
    },
    {
      path: "2.4",
      name: "Penguin",
      type: "animal",
      icon: "🐧",
      species: "Aptenodytes forsteri",
      habitat: "Arctic",
      dangerLevel: "low",
      size: "small",
      isDraggable: true,
    },
    {
      path: "2.5",
      name: "Flamingo",
      type: "animal",
      icon: "🦩",
      species: "Phoenicopterus roseus",
      habitat: "Wetlands",
      dangerLevel: "low",
      size: "medium",
      isDraggable: true,
    },

    // Reptiles
    {
      path: "3",
      name: "Reptiles",
      type: "category",
      icon: "🦎",
    },
    {
      path: "3.1",
      name: "Snake",
      type: "animal",
      icon: "🐍",
      species: "Python reticulatus",
      habitat: "Forest",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "3.2",
      name: "Crocodile",
      type: "animal",
      icon: "🐊",
      species: "Crocodylus niloticus",
      habitat: "Wetlands",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "3.3",
      name: "Turtle",
      type: "animal",
      icon: "🐢",
      species: "Chelonia mydas",
      habitat: "Ocean",
      dangerLevel: "low",
      size: "medium",
      isDraggable: true,
    },
    {
      path: "3.4",
      name: "Lizard",
      type: "animal",
      icon: "🦎",
      species: "Varanus komodoensis",
      habitat: "Desert",
      dangerLevel: "medium",
      size: "medium",
      isDraggable: true,
    },

    // Marine Life
    {
      path: "4",
      name: "Marine Life",
      type: "category",
      icon: "🌊",
    },
    {
      path: "4.1",
      name: "Shark",
      type: "animal",
      icon: "🦈",
      species: "Carcharodon carcharias",
      habitat: "Ocean",
      dangerLevel: "high",
      size: "large",
      isDraggable: true,
    },
    {
      path: "4.2",
      name: "Dolphin",
      type: "animal",
      icon: "🐬",
      species: "Tursiops truncatus",
      habitat: "Ocean",
      dangerLevel: "low",
      size: "large",
      isDraggable: true,
    },
    {
      path: "4.3",
      name: "Octopus",
      type: "animal",
      icon: "🐙",
      species: "Octopus vulgaris",
      habitat: "Ocean",
      dangerLevel: "medium",
      size: "medium",
      isDraggable: true,
    },
    {
      path: "4.4",
      name: "Whale",
      type: "animal",
      icon: "🐋",
      species: "Balaenoptera musculus",
      habitat: "Ocean",
      dangerLevel: "low",
      size: "extra-large",
      isDraggable: true,
    },
  ];

  return animalsData;
}

export function createZooZonesData(): ZooZoneData[] {
  const zooZonesData: ZooZoneData[] = [
    // Dangerous Animals Zone
    {
      path: "1",
      name: "Dangerous Animals Zone",
      type: "zone",
      icon: "⚠️",
      capacity: 10,
      currentAnimals: [],
      requirements: ["high-security", "experienced-handlers"],
      isDroppable: true,
    },
    {
      path: "1.1",
      name: "Large Predators",
      type: "section",
      icon: "🦁",
      capacity: 5,
      currentAnimals: [],
      requirements: ["large-enclosure", "reinforced-barriers"],
      isDroppable: true,
    },
    {
      path: "1.2",
      name: "Venomous Species",
      type: "section",
      icon: "🐍",
      capacity: 8,
      currentAnimals: [],
      requirements: ["climate-controlled", "antivenom-available"],
      isDroppable: true,
    },

    // Family-Friendly Zone
    {
      path: "2",
      name: "Family-Friendly Zone",
      type: "zone",
      icon: "👨‍👩‍👧‍👦",
      capacity: 20,
      currentAnimals: [],
      requirements: ["safe-viewing", "educational-signs"],
      isDroppable: true,
    },
    {
      path: "2.1",
      name: "Petting Zoo",
      type: "section",
      icon: "🐑",
      capacity: 15,
      currentAnimals: [],
      requirements: ["gentle-animals", "supervised-interaction"],
      isDroppable: true,
    },
    {
      path: "2.2",
      name: "Small Animals",
      type: "section",
      icon: "🐰",
      capacity: 10,
      currentAnimals: [],
      requirements: ["indoor-enclosure", "comfortable-viewing"],
      isDroppable: true,
    },

    // Aquatic Zone
    {
      path: "3",
      name: "Aquatic Zone",
      type: "zone",
      icon: "🌊",
      capacity: 15,
      currentAnimals: [],
      requirements: ["water-systems", "filtration", "marine-specialists"],
      isDroppable: true,
    },
    {
      path: "3.1",
      name: "Large Aquatic Tank",
      type: "section",
      icon: "🐋",
      capacity: 5,
      currentAnimals: [],
      requirements: ["massive-tank", "salt-water", "deep-water"],
      isDroppable: true,
    },
    {
      path: "3.2",
      name: "Touch Pool",
      type: "section",
      icon: "🐠",
      capacity: 12,
      currentAnimals: [],
      requirements: ["shallow-water", "safe-species", "interactive"],
      isDroppable: true,
    },

    // Aviary
    {
      path: "4",
      name: "Aviary Zone",
      type: "zone",
      icon: "🦅",
      capacity: 25,
      currentAnimals: [],
      requirements: ["flight-space", "nesting-areas", "bird-care"],
      isDroppable: true,
    },
    {
      path: "4.1",
      name: "Birds of Prey",
      type: "section",
      icon: "🦅",
      capacity: 8,
      currentAnimals: [],
      requirements: ["secure-perches", "hunting-space"],
      isDroppable: true,
    },
    {
      path: "4.2",
      name: "Tropical Birds",
      type: "section",
      icon: "🦜",
      capacity: 15,
      currentAnimals: [],
      requirements: ["climate-controlled", "colorful-habitat"],
      isDroppable: true,
    },

    // Conservation Center
    {
      path: "5",
      name: "Conservation Center",
      type: "zone",
      icon: "🌱",
      capacity: 12,
      currentAnimals: [],
      requirements: ["research-facilities", "breeding-programs"],
      isDroppable: true,
    },
    {
      path: "5.1",
      name: "Endangered Species",
      type: "section",
      icon: "🐼",
      capacity: 8,
      currentAnimals: [],
      requirements: ["specialized-care", "breeding-support"],
      isDroppable: true,
    },
  ];

  return zooZonesData;
}
