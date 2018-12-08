const { spawnSync } = require("child_process");
const xcode = require("xcode");
const { join, basename, dirname, isAbsolute } = require("path");
const { existsSync, renameSync, writeFileSync, unlinkSync } = require("fs");
const { sync } = require("glob");
const rp = require("request-promise-native");
module.exports = [
  {
    name: "add-mlmodel <modelpath>",
    description: "Add and compile mlmodel into your IOS project assets",
    func: async (argv, _, options) => {
      //Is the argument a path or a URL?
      //URL check
      let tempPath;
      if (argv[0].includes("://")) {
        //URL!
        //transfer URL to our temp Path
        const data = await rp(uri);
        const outFile = join(process.env.TMPDIR, basename(uri));
        writeFileSync(outFile, data);
        tempPath = compileMLModel(outFile);
      } else {
        tempPath = compileMLModel(argv[0]);
      }
      const outPath = options.outPath ? options.outPath : ".";
      const finalLocation = join(outPath, basename(tempPath));
      if (tempPath) {
        renameSync(tempPath, finalLocation);
      }
      const projectPath = sync(
        join(process.cwd(), "ios", "**", "project.pbxproj")
      )[0];
      addToProject(finalLocation, projectPath);
      const base = basename(finalLocation);
      const parts = base.split(".");
      parts.pop();
      const newBase = parts.join(".");
      console.log(
        `Model added. You may refer to it as ${newBase} in your code.`
      );
    }
  }
];
const compileMLModel = (originPath, destinationPath = process.env.TMPDIR) => {
  const result = join(destinationPath, basename(originPath) + "c");
  try {
    unlinkSync(result);
  } catch (e) {}
  spawnSync(
    "xcrun",
    ["coremlcompiler", "compile", originPath, destinationPath],
    {
      stdio: "inherit"
    }
  );
  //We know what the tail result will be
  return existsSync(result) ? result : false;
};
const addToProject = (fileToAdd, projectPath) => {
  if (!isAbsolute(fileToAdd)) fileToAdd = join(process.cwd(), fileToAdd);
  const project = xcode.project(projectPath);
  project.parseSync();
  console.log("Adding file ", fileToAdd);
  project.addResourceFile(fileToAdd, {
    target: project.getFirstTarget().uuid,
    lastKnownFileType: "folder"
  });
  const outText = project.writeSync();
  writeFileSync(projectPath, outText);
};
