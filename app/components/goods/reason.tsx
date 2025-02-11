import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Selection = {
    [key in SalesType]?: string
}

interface Props {
    form: any
    selection: Selection
}

export function ReasonComp({ form, selection }: Props) {
    return (
        <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Reason" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {
                                Object.entries(selection).map((ele, index) =>
                                    <SelectItem value={ele[0]} key={index}>{ele[1]}</SelectItem>)
                            }
                        </SelectContent>
                    </Select>
                    <FormDescription>
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}