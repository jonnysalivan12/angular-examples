import { Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@schematics/angular/utility/workspace';

export namespace SchematicsUtils {
  export async function getProjectPath(tree: Tree, projectName: string): Promise<string | undefined> {
    const workspace = await getWorkspace(tree);

    const project = workspace.projects.get(projectName);
    if (project) {
      return project.sourceRoot;
    } else {
      return undefined;
    }
  }
}
