
<template>
<div>
// to do commented code below
</div>


</template>

<!--2. Optional power-user action: “Regroup everything”-->

<!--If you really want to support a “nuclear reorganize” mode:-->

<!--Put it in Options → Advanced, not in the popup.-->

<!--Label it clearly, e.g.:-->a

<!--“Regroup all tabs by age (including my custom groups)”-->

<!--Add a warning text:-->

<!--“This will move tabs out of your custom groups and reassign them to age-based groups. This cannot be fully undone.”-->

<!--Require an explicit confirmation dialog when clicked.-->

<!--This way:-->

<!--Normal users never see this.-->

<!--Power users who understand the consequence can choose it deliberately.-->

<!--If you want any prompt at all-->

<!--If you insist on a prompt, scope it narrowly and make the impact crystal clear:-->

<!--Trigger only when:-->

<!--The user clicks a manual “Regroup now” button, and-->

<!--There are tabs in user-created groups.-->

<!--Show a concise dialog:-->

<!--Regroup tabs by age-->

<!--You have tabs in your own groups.-->

<!--Regroup only ungrouped + plugin groups (recommended)-->

<!--Regroup all tabs, including my custom groups (destructive)-->

<!--Default selection: “Regroup only ungrouped + plugin groups”.-->

<!--But even this is arguably too complex for an MVP. A simpler, safer route is: no prompt, just never touch user groups.-->
<!--Alignment with your design philosophy-->

<!--This approach matches your earlier decisions:-->

<!--“Optimize for ‘it just organizes my mess’ rather than ‘I can engineer the perfect taxonomy’”.-->

<!--Keep the main UI minimal; advanced, potentially destructive options go in Options → Advanced.-->

<!--Protect the user’s active flow and existing organization; don’t fight their workflow.-->
<!--Concrete recommendation-->

<!--Do not ask users a generic question about regrouping everything.-->

<!--Do:-->

<!--By default: regroup only ungrouped tabs + your age groups.-->

<!--Never touch user-created groups unless they explicitly opt in via an advanced, clearly labeled action.-->

<!--If you later add a “Regroup all” feature, gate it behind:-->

<!--Advanced settings-->

<!--Clear warnings-->

<!--Explicit confirmation-->

<!--If you share your current Options layout (sections, existing toggles), I can suggest exact wording and placement for these settings.-->
