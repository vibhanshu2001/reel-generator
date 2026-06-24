import prisma from './src/db';

function similarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

async function main() {
  const projects = await prisma.project.findMany({
    include: { scenes: { orderBy: { sequenceNumber: 'asc' } } }
  });

  console.log(`Checking ${projects.length} projects for consecutive dialogue similarity...`);
  for (const project of projects) {
    let duplicateCount = 0;
    const dupScenes: string[] = [];

    for (let i = 0; i < project.scenes.length - 1; i++) {
      const s1 = project.scenes[i];
      const s2 = project.scenes[i + 1];
      const text1 = s1.text || '';
      const text2 = s2.text || '';

      const sim = similarity(text1, text2);
      if (sim > 0.8) {
        duplicateCount++;
        dupScenes.push(`- Scene ${s1.sequenceNumber} ("${text1}") vs Scene ${s2.sequenceNumber} ("${text2}") -> ${Math.round(sim * 100)}% similar`);
      }
    }

    if (duplicateCount > 0) {
      console.log(`\nProject: "${project.topic}" (ID: ${project.id})`);
      console.log(`Found ${duplicateCount} consecutive duplicate/similar dialogues:`);
      dupScenes.forEach(line => console.log(line));
    }
  }
  console.log('\nCheck completed.');
}

main().catch(console.error);
